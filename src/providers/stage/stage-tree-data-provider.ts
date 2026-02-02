import * as vscode from "vscode";
import { Build } from "../../types/builds";
import { Project } from "../../types/types";
import { TimelineRecord } from "../../types/stages";
import { getBuildStages } from "../../utils/requests";
import { StageItem } from "./stage-item";
import { formatDuration } from "../../utils/format-duration";

const STAGE_CONTEXT_VALUE = "stage";

export class StageTreeDataProvider
  implements vscode.TreeDataProvider<StageItem>, vscode.Disposable
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    StageItem | undefined | void
  > = new vscode.EventEmitter<StageItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<StageItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private records: StageItem[] = [];
  private allRecords: TimelineRecord[] = [];
  private project: Project | undefined = undefined;
  private build: Build | undefined = undefined;
  private pollingIntervalId: NodeJS.Timeout | undefined;
  private readonly POLLING_INTERVAL = 5000; // 5 seconds
  private pollingEnabled: boolean = true;

  refresh(): void {
    this.records = [];
    this.stopPolling();
    this._onDidChangeTreeData.fire();
  }

  private shouldPoll(): boolean {
    return this.hasInProgressRecords(this.allRecords);
  }

  private hasInProgressRecords(records: TimelineRecord[]): boolean {
    return records.some((record) => {
      const state = record.state?.toLowerCase();
      return state === "inprogress" || state === "pending";
    });
  }

  private startPolling(): void {
    if (this.pollingIntervalId) {
      return; // Already polling
    }

    this.pollingIntervalId = setInterval(() => {
      this.refreshStages();
    }, this.POLLING_INTERVAL);
    this.updateContextState(true);
  }

  private stopPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = undefined;
      this.updateContextState(false);
    }
  }

  private updatePollingState(): void {
    if (this.pollingEnabled && this.shouldPoll() && !this.pollingIntervalId) {
      this.startPolling();
    } else if ((!this.pollingEnabled || !this.shouldPoll()) && this.pollingIntervalId) {
      this.stopPolling();
    } else if (!this.pollingEnabled || !this.shouldPoll()) {
      // Ensure context is updated even if we weren't polling
      this.updateContextState(false);
    }
  }

  private updateContextState(active: boolean): void {
    vscode.commands.executeCommand(
      "setContext",
      "azurePipelinesRunner.stagePollingActive",
      active
    );
  }

  public togglePolling(): void {
    this.pollingEnabled = !this.pollingEnabled;
    if (this.pollingEnabled) {
      this.updatePollingState();
    } else {
      this.stopPolling();
      this.updateContextState(false);
    }
  }

  public isPollingEnabled(): boolean {
    return this.pollingEnabled;
  }

  dispose(): void {
    this.stopPolling();
  }

  getTreeItem(element: StageItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: StageItem): Promise<StageItem[]> {
    if (!element) {
      return this.records;
    } else if (element.contextValue === STAGE_CONTEXT_VALUE) {
      const children = this.allRecords
        .filter((record) => record.name !== "Checkpoint")
        .filter((record) => record.parentId === element.timelineRecord.id)
        .sort((a, b) => {
          if (a.order && b.order) {
            return a.order - b.order;
          }
          return 0;
        });

      return this.createStageItems(children, this.allRecords);
    }

    return [];
  }

  async loadStages(build: Build, project: Project): Promise<void> {
    // CRITICAL: Stop any existing polling from previous build
    this.stopPolling();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: `Loading stages for build ${build.buildNumber}`,
        cancellable: false,
      },
      async (progress) => {
        this.project = project;
        this.build = build;

        progress.report({ increment: 0 });

        const buildTimeline = await getBuildStages(project.name, build.id);
        this.allRecords = buildTimeline.records.map((record) => {
          record.projectName = project.name;
          record.buildId = build.id;
          return record;
        });
        const timelineRecordsStages = buildTimeline.records
          .filter((record) => record.type === "Stage" && !record.parentId)
          .sort((a, b) => {
            if (a.order && b.order) {
              return a.order - b.order;
            }
            return 0;
          });

        this.records = this.createStageItems(
          timelineRecordsStages,
          buildTimeline.records
        );

        this._onDidChangeTreeData.fire();

        progress.report({ increment: 100 });

        // Start polling if needed for the new build
        this.updatePollingState();
      }
    );
  }

  private createStageItems(
    records: TimelineRecord[],
    allRecords: TimelineRecord[]
  ): StageItem[] {
    return records.map((record) => {
      const hasChildren = allRecords.some(
        (child) => child.parentId === record.id
      );

      if (record?.startTime && record?.finishTime) {
        const startTime = new Date(record.startTime);
        const finishTime = new Date(record.finishTime);
        const totalTime = new Date(finishTime.getTime() - startTime.getTime());
        record.name += " • " + formatDuration(totalTime);
      }

      return new StageItem(
        record.name,
        hasChildren
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        STAGE_CONTEXT_VALUE,
        record
      );
    });
  }

  public async refreshStages() {
    if (!this.build || !this.project) {
      return;
    }

    await this.loadStages(this.build, this.project);

    // Note: updatePollingState() is already called within loadStages()
  }
}
