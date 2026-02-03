import * as vscode from "vscode";
import { TimelineRecord } from "../../types/stages";
import path from "path";

export class StageItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly timelineRecord: TimelineRecord,
    public readonly isWaitingForApproval: boolean = false
  ) {
    super(label, collapsibleState);
    this.iconPath = this.getIconPath();
    this.tooltip = this.getTooltip();
    
    // Set command for stages waiting for approval (highest priority)
    if (this.isWaitingForApproval) {
      this.command = {
        command: "azurePipelinesRunner.approveStage",
        title: "Approve or Reject Stage",
        arguments: [{ timelineRecord: this.timelineRecord }]
      };
    }
    // Only set command for tasks (which have logs), not for stages or jobs
    else if (this.timelineRecord.type === "Task" && this.timelineRecord.log) {
      this.command = {
        command: "azurePipelinesRunner.openStageLog",
        title: "Open Task Log",
        arguments: [{ timelineRecord: this.timelineRecord }]
      };
    }
  }

  private getIconPath(): vscode.ThemeIcon {
    // Check for approval waiting state first (highest priority)
    if (this.isWaitingForApproval) {
      return new vscode.ThemeIcon("workspace-unknown", new vscode.ThemeColor("testing.iconQueued"));
    }

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
        return new vscode.ThemeIcon("skip", new vscode.ThemeColor("icon.foreground"));
      default:
        if (this.timelineRecord.state === "inProgress") {
          return new vscode.ThemeIcon("loading~spin");
        }

        if (this.timelineRecord.state === "pending" || this.timelineRecord.state === "notStarted") {
          return new vscode.ThemeIcon("clockface", new vscode.ThemeColor("charts.blue"));
        }

        return new vscode.ThemeIcon("circle-outline");
    }
  }

  private getTooltip(): string {
    if (this.isWaitingForApproval) {
      return `⏳ Waiting for manual approval\n${this.timelineRecord.name}`;
    }
    return this.timelineRecord.name;
  }
}
