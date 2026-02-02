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
    
    // Only set command for tasks (which have logs), not for stages or jobs
    if (this.timelineRecord.type === "Task" && this.timelineRecord.log) {
      this.command = {
        command: "azurePipelinesRunner.openStageLog",
        title: "Open Task Log",
        arguments: [{ timelineRecord: this.timelineRecord }]
      };
    }
  }

  private getIconPath(): { light: string; dark: string } {
    // Check if waiting for approval first (highest priority)
    if (this.isWaitingForApproval) {
      return {
        light: path.join(
          __filename,
          "..",
          "..",
          "..",
          "..",
          "resources",
          "light",
          "approval-waiting.svg"
        ),
        dark: path.join(
          __filename,
          "..",
          "..",
          "..",
          "..",
          "resources",
          "dark",
          "approval-waiting.svg"
        ),
      };
    }

    let iconName = "";
    switch (this.timelineRecord.result) {
      case "succeeded":
        iconName = "succeeded.svg";
        break;
      case "failed":
      case "abandoned":
        iconName = "failed.svg";
        break;
      case "canceled":
        iconName = "canceled.svg";
        break;
      case "succeededWithIssues":
        iconName = "succeededWithIssues.svg";
        break;
      case "skipped":
        iconName = "skipped.svg";
        return {
          light: path.join(
            __filename,
            "..",
            "..",
            "..",
            "..",
            "resources",
            "light",
            iconName
          ),
          dark: path.join(
            __filename,
            "..",
            "..",
            "..",
            "..",
            "resources",
            "dark",
            iconName
          ),
        };
      default:
        if (this.timelineRecord.state === "inProgress") {
          iconName = "inProgress.svg";
          break;
        }

        if (this.timelineRecord.state === "pending" || this.timelineRecord.state === "notStarted") {
          iconName = "pending.svg";
          return {
            light: path.join(
              __filename,
              "..",
              "..",
              "..",
              "..",
              "resources",
              "light",
              iconName
            ),
            dark: path.join(
              __filename,
              "..",
              "..",
              "..",
              "..",
              "resources",
              "dark",
              iconName
            ),
          };
        }

        iconName = "";
        break;
    }

    return {
      light: path.join(
        __filename,
        "..",
        "..",
        "..",
        "..",
        "resources",
        iconName
      ),
      dark: path.join(
        __filename,
        "..",
        "..",
        "..",
        "..",
        "resources",
        iconName
      ),
    };
  }

  private getTooltip(): string {
    if (this.isWaitingForApproval) {
      return `⏳ Waiting for manual approval\n${this.timelineRecord.name}`;
    }
    return this.timelineRecord.name;
  }
}
