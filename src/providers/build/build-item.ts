import * as vscode from "vscode";
import { Build } from "../../types/builds";
import { Pipeline, Project } from "../../types/types";
import path from "path";
import { formatDuration } from "../../utils/format-duration";

export class BuildItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly builds?: Build[],
    public readonly project?: Project,
    public readonly pipeline?: Pipeline
  ) {
    super(label, collapsibleState);
    this.iconPath = this.getIconPath();
    this.tooltip = this.getTooltip();

    if (contextValue === "build" && builds && builds.length > 0) {
      this.command = {
        command: "azurePipelinesRunner.loadStages",
        title: "Load Stages",
        arguments: [{ builds, project }],
      };
    }
  }

  private getIconPath(): { light: string; dark: string } {
    if (
      this.contextValue === "build" &&
      this.builds &&
      this.builds.length > 0
    ) {
      const build = this.builds[0];
      let iconName = "";
      switch (build.result) {
        case "succeeded":
          iconName = "succeeded.svg";
          break;
        case "failed":
          iconName = "failed.svg";
          break;
        case "canceled":
          iconName = "canceled.svg";
          break;
        case "partiallySucceeded":
          iconName = "partiallySucceeded.svg";
          break;
        default:
          if (build.status === "inProgress") {
            iconName = "clock.svg";
            break;
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
    } else {
      return {
        light: path.join(
          __filename,
          "..",
          "..",
          "..",
          "..",
          "resources",
          "repo.svg"
        ),
        dark: path.join(
          __filename,
          "..",
          "..",
          "..",
          "..",
          "resources",
          "repo.svg"
        ),
      };
    }
  }

  private getTooltip(): vscode.MarkdownString | string {
    if (
      this.contextValue === "build" &&
      this.builds &&
      this.builds.length > 0
    ) {
      const build = this.builds[0];
      const markdown = new vscode.MarkdownString();
      markdown.supportHtml = true;
      markdown.isTrusted = true;
      markdown.appendMarkdown(`### Build Details\n`);
      markdown.appendMarkdown(`---\n`);
      markdown.appendMarkdown(`**Build Number**: ${build.buildNumber}\n\n`);
      markdown.appendMarkdown(`**Status**: ${build.status}\n\n`);

      if (build.result) {
        markdown.appendMarkdown(`**Result**: ${build.result}\n\n`);
      }

      const startTime = new Date(build.startTime);
      if (build.finishTime) {
        const finishTime = new Date(build.finishTime);
        const totalTime = new Date(finishTime.getTime() - startTime.getTime());

        markdown.appendMarkdown(
          `**Durantion**: ${formatDuration(totalTime)}\n\n`
        );
      }

      markdown.appendMarkdown(`---\n`);

      if (build.requestedFor) {
        const avatarUrl = build.requestedFor._links.avatar.href;
        markdown.appendMarkdown(
          `**Requested By**: <img src="${avatarUrl}" width="16" height="16" /> ${build.requestedFor.displayName}\n\n`
        );
      }

      return markdown;
    } else {
      return "";
    }
  }
}
