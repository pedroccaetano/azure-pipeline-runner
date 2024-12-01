import * as vscode from "vscode";
import { Build } from "../../types/builds";
import { Project } from "../../types/types";
import { TimelineRecord } from "../../types/stages";
import { getBuildStages } from "../../utils/requests";
import { StageItem } from "./stage-item";
import { formatDuration } from "../../utils/format-duration";

const STAGE_CONTEXT_VALUE = "stage";

export class StageTreeDataProvider
  implements vscode.TreeDataProvider<StageItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    StageItem | undefined | void
  > = new vscode.EventEmitter<StageItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<StageItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private records: StageItem[] = [];
  private allRecords: TimelineRecord[] = [];

  refresh(): void {
    this.records = [];
    this._onDidChangeTreeData.fire();
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
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: `Loading stages for build ${build.buildNumber}`,
        cancellable: false,
      },
      async (progress) => {
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
}
