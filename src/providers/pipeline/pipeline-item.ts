import * as vscode from "vscode";
import * as path from "path";
import { Pipeline, Project } from "../../types/types";

export class PipelineItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly pipeline?: Pipeline,
    public readonly project?: Project
  ) {
    super(label, collapsibleState);
    this.iconPath = this.getIconPath();
    this.tooltip = "Click!";
    if (contextValue === "pipeline" && pipeline && project) {
      this.command = {
        command: "azurePipelinesRunner.loadBuilds",
        title: "Load Builds",
        arguments: [{ pipeline, project }],
      };
    }
  }

  private getIconPath(): { light: string; dark: string } {
    if (this.contextValue === "folder") {
      return {
        light: path.join(
          __filename,
          "..",
          "..",
          "..",
          "..",
          "resources",
          "light",
          "folder.svg"
        ),
        dark: path.join(
          __filename,
          "..",
          "..",
          "..",
          "..",
          "resources",
          "dark",
          "folder.svg"
        ),
      };
    } else if (this.contextValue === "pipeline") {
      return {
        light: path.join(
          __filename,
          "..",
          "..",
          "..",
          "..",
          "resources",
          "pipeline.svg"
        ),
        dark: path.join(
          __filename,
          "..",
          "..",
          "..",
          "..",
          "resources",
          "pipeline.svg"
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
}
