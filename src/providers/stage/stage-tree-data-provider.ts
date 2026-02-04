import * as vscode from "vscode";
import { Build } from "../../types/builds";
import { Project } from "../../types/types";
import { TimelineRecord } from "../../types/stages";
import { getBuildStages } from "../../utils/requests";
import { StageItem } from "./stage-item";
import { formatDuration } from "../../utils/format-duration";
import { isStageWaitingForApproval } from "../../utils/approval-detection";

const STAGE_CONTEXT_VALUE = "stage";
const STAGE_STOPPED_CONTEXT_VALUE = "stage-stopped";
const PHASE_CONTEXT_VALUE = "phase";
const TASK_CONTEXT_VALUE = "task";

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
  private configChangeListener: vscode.Disposable | undefined;
  private isViewVisible: boolean = true;

  constructor() {
    // Listen for configuration changes
    this.configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("azurePipelinesRunner.enablePolling")) {
        this.updatePollingState();
      }
    });
  }

  setViewVisible(visible: boolean): void {
    this.isViewVisible = visible;
    this.updatePollingState();
  }

  getCurrentProject(): Project | undefined {
    return this.project;
  }

  getCurrentBuild(): Build | undefined {
    return this.build;
  }

  getAllRecords(): TimelineRecord[] {
    return this.allRecords;
  }

  pausePolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = undefined;
    }
  }

  resumePolling(): void {
    if (this.shouldPoll() && !this.pollingIntervalId) {
      this.startPolling();
    }
  }

  refresh(): void {
    this.records = [];
    this.stopPolling();
    this._onDidChangeTreeData.fire();
  }

  private shouldPoll(): boolean {
    const config = vscode.workspace.getConfiguration("azurePipelinesRunner");
    const pollingEnabled = config.get<boolean>("enablePolling", true);

    if (!pollingEnabled || !this.isViewVisible) {
      return false;
    }

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
    if (this.shouldPoll() && !this.pollingIntervalId) {
      this.startPolling();
    } else if (!this.shouldPoll() && this.pollingIntervalId) {
      this.stopPolling();
    }
  }

  private updateContextState(active: boolean): void {
    vscode.commands.executeCommand(
      "setContext",
      "azurePipelinesRunner.stagePollingActive",
      active
    );
  }

  dispose(): void {
    this.stopPolling();
    this.configChangeListener?.dispose();
  }

  getTreeItem(element: StageItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: StageItem): Promise<StageItem[]> {
    if (!element) {
      return this.records;
    } else if (element.contextValue === STAGE_CONTEXT_VALUE) {
      // Get direct children (excluding Jobs since they're hidden)
      const directChildren = this.allRecords
        .filter((record) => record.name !== "Checkpoint")
        .filter((record) => record.type !== "Job")
        .filter((record) => record.parentId === element.timelineRecord.id);

      // If this is a Phase, also get Tasks from the hidden Job child
      const children = element.timelineRecord.type === "Phase"
        ? this.allRecords
            .filter((record) => {
              // Find the Job child of this Phase
              const jobChild = this.allRecords.find(
                (r) => r.type === "Job" && r.parentId === element.timelineRecord.id
              );
              // Include Tasks that are children of that Job
              return jobChild && record.parentId === jobChild.id && record.name !== "Checkpoint";
            })
        : directChildren;

      return this.createStageItems(
        (children.length > 0 ? children : directChildren).sort((a, b) => {
          if (a.order && b.order) {
            return a.order - b.order;
          }
          return 0;
        }),
        this.allRecords
      );
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

      // Check if this stage is waiting for approval
      const waitingForApproval = isStageWaitingForApproval(
        record.id,
        allRecords
      );

      if (record?.startTime && record?.finishTime) {
        const startTime = new Date(record.startTime);
        const finishTime = new Date(record.finishTime);
        const totalTime = new Date(finishTime.getTime() - startTime.getTime());
        record.name += " • " + formatDuration(totalTime);
      }

      // Determine the appropriate context value based on the record type and state
      let contextValue = STAGE_CONTEXT_VALUE;
      if (record.type === "Phase") {
        contextValue = PHASE_CONTEXT_VALUE;
      } else if (record.type === "Task") {
        contextValue = TASK_CONTEXT_VALUE;
      } else if (record.type === "Stage") {
        // Check if the stage is stopped (not in progress or pending)
        const isRunning = record.state === "inProgress" || record.state === "pending" || record.state === "notStarted";
        contextValue = isRunning ? STAGE_CONTEXT_VALUE : STAGE_STOPPED_CONTEXT_VALUE;
      }

      return new StageItem(
        record.name,
        hasChildren
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        contextValue,
        record,
        waitingForApproval
      );
    });
  }

  public async refreshStages() {
    // Check if polling is enabled
    const config = vscode.workspace.getConfiguration("azurePipelinesRunner");
    const pollingEnabled = config.get<boolean>("enablePolling", true);
    if (!pollingEnabled) {
      this.stopPolling();
      return;
    }

    if (!this.build || !this.project) {
      return;
    }

    await this.loadStages(this.build, this.project);

    // Note: updatePollingState() is already called within loadStages()
  }
}
