import * as vscode from "vscode";
import { TimelineRecord } from "../../types/stages";
import path from "path";

export class StageItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly timelineRecord: TimelineRecord
  ) {
    super(label, collapsibleState);
    this.iconPath = this.getIconPath();
    
    // Only set command for tasks (which have logs), not for stages or jobs
    if (this.timelineRecord.type === "Task" && this.timelineRecord.log) {
      this.command = {
        command: "azurePipelinesRunner.openStageLog",
        title: "Open Task Log",
        arguments: [{ timelineRecord: this.timelineRecord }]
      };
    }
  }

  private getIconPath(): vscode.ThemeIcon {
    switch (this.timelineRecord.result) {
      case "succeeded":
        return new vscode.ThemeIcon("pass", new vscode.ThemeColor("testing.iconPassed"));
      case "failed":
      case "abandoned":
        return new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"));
      case "canceled":
        return new vscode.ThemeIcon("circle-slash", new vscode.ThemeColor("testing.iconSkipped"));
      case "succeededWithIssues":
        return new vscode.ThemeIcon("warning", new vscode.ThemeColor("testing.iconQueued"));
      case "skipped":
        return new vscode.ThemeIcon("debug-step-over");
      default:
        if (this.timelineRecord.state === "inProgress") {
          return new vscode.ThemeIcon("loading~spin");
        }

        if (this.timelineRecord.state === "pending" || this.timelineRecord.state === "notStarted") {
          return new vscode.ThemeIcon("clock", new vscode.ThemeColor("testing.iconQueued"));
        }

        return new vscode.ThemeIcon("circle-outline");
    }
  }
}
