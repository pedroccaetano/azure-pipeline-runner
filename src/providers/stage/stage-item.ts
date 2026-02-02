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
    
    // Set command to open log when clicking on the stage item
    this.command = {
      command: "azurePipelinesRunner.openStageLog",
      title: "Open Stage Log",
      arguments: [{ timelineRecord: this.timelineRecord }]
    };
  }

  private getIconPath(): { light: string; dark: string } {
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
}
