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

    const isBuildItem = contextValue === "build" || contextValue === "build-pinned" || 
                        contextValue === "build-running" || contextValue === "build-running-pinned";
    if (isBuildItem && builds && builds.length > 0) {
      this.command = {
        command: "azurePipelinesRunner.loadStages",
        title: "Load Stages",
        arguments: [{ builds, project }],
      };
    }
  }

  private getIconPath(): vscode.ThemeIcon {
    // Loading state
    if (this.contextValue === "loading") {
      return new vscode.ThemeIcon("loading~spin");
    }

    const isBuildItem = this.contextValue === "build" || this.contextValue === "build-pinned" ||
                        this.contextValue === "build-running" || this.contextValue === "build-running-pinned";
    if (isBuildItem && this.builds && this.builds.length > 0) {
      const build = this.builds[0];
      
      // Check result first (for completed builds)
      if (build.result) {
        switch (build.result) {
          case "succeeded":
            return new vscode.ThemeIcon("pass", new vscode.ThemeColor("testing.iconPassed"));
          case "failed":
            return new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"));
          case "canceled":
            return new vscode.ThemeIcon("circle-slash", new vscode.ThemeColor("testing.iconSkipped"));
          case "partiallySucceeded":
            return new vscode.ThemeIcon("warning", new vscode.ThemeColor("testing.iconQueued"));
        }
      }
      
      // If no result yet, check status (for in-progress/queued builds)
      switch (build.status) {
        case "inProgress":
          return new vscode.ThemeIcon("loading~spin");
        case "notStarted":
        case "postponed":
        case "none":
        default:
          return new vscode.ThemeIcon("clock", new vscode.ThemeColor("testing.iconQueued"));
      }
    } else {
      return new vscode.ThemeIcon("repo");
    }
  }

  private getTooltip(): vscode.MarkdownString | string {
    const isBuildItem = this.contextValue === "build" || this.contextValue === "build-pinned" ||
                        this.contextValue === "build-running" || this.contextValue === "build-running-pinned";
    if (isBuildItem && this.builds && this.builds.length > 0) {
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

      if (build.retentionLeases && build.retentionLeases.length > 0) {
        markdown.appendMarkdown(`**Retention Leases**: ${build.retentionLeases.length}\n\n`);
        markdown.appendMarkdown(`$(pinned) This build is pinned and protected from deletion.\n\n`);
        markdown.appendMarkdown(`---\n`);
      }

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
