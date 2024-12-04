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
  }

  private getIconPath(): { light: string; dark: string } {
    let iconName = "";
    switch (this.timelineRecord.result) {
      case "succeeded":
        iconName = "succeeded.svg";
        break;
      case "failed":
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
