import * as vscode from "vscode";
import { getPipelines, getProjects } from "../../utils/requests";
import { Pipeline } from "../../types/types";
import { PipelineItem } from "./pipeline-item";

export class PipelineTreeDataProvider
  implements vscode.TreeDataProvider<PipelineItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    PipelineItem | undefined | void
  > = new vscode.EventEmitter<PipelineItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<PipelineItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private pipelines: Pipeline[] = [];

  constructor() {}

  refresh(): void {
    this.pipelines = [];
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PipelineItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PipelineItem): Promise<PipelineItem[]> {
    if (!element) {
      // Top-level: Projects
      const projects = (await getProjects()) || [];
      return projects.map(
        (project) =>
          new PipelineItem(
            project.name,
            vscode.TreeItemCollapsibleState.Collapsed,
            "project",
            undefined,
            project
          )
      );
    } else if (element?.contextValue === "project") {
      // Second-level: Pipelines or Folders
      this.pipelines =
        (await getPipelines(element?.project?.name as string)) || [];
      const rootFolders = this.getRootFolders(this.pipelines);
      const rootPipelines = this.getRootPipelines(this.pipelines);
      const rootItems = [
        ...rootFolders.map(
          (folder) =>
            new PipelineItem(
              folder,
              vscode.TreeItemCollapsibleState.Collapsed,
              "folder",
              undefined,
              element.project
            )
        ),
        ...rootPipelines.map(
          (pipeline) =>
            new PipelineItem(
              pipeline.name,
              vscode.TreeItemCollapsibleState.None,
              "pipeline",
              pipeline,
              element.project
            )
        ),
      ];
      return rootItems;
    } else if (element?.contextValue === "folder") {
      // Handle folder level
      const childItems = this.getChildItems(element.label);
      return childItems.map(
        (item) =>
          new PipelineItem(
            item.label,
            item.isFolder
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            item.isFolder ? "folder" : "pipeline",
            item.pipeline,
            element.project
          )
      );
    } else if (element?.contextValue === "pipeline") {
      vscode.commands.executeCommand("azurePipelinesRunner.loadBuilds", {
        pipeline: element.pipeline,
        project: element.project,
      });

      return [];
    } else {
      return [];
    }
  }

  private getRootFolders(pipelines: Pipeline[]): string[] {
    const folders = pipelines
      .map((pipeline) => pipeline.folder.split("\\")[1])
      .filter((folder) => folder && folder !== "");
    return Array.from(new Set(folders));
  }

  private getRootPipelines(pipelines: Pipeline[]): Pipeline[] {
    return pipelines.filter((pipeline) => pipeline.folder === "\\");
  }

  private getChildItems(
    folder: string
  ): { label: string; isFolder: boolean; pipeline?: Pipeline }[] {
    const childFolders = new Set<string>();
    const childPipelines: {
      label: string;
      isFolder: boolean;
      pipeline?: Pipeline;
    }[] = [];

    this.pipelines.forEach((pipeline) => {
      const parts = pipeline.folder.split("\\");
      if (parts[1] === folder) {
        if (parts.length > 2) {
          childFolders.add(parts.slice(1, 3).join("\\"));
        } else {
          childPipelines.push({
            label: pipeline.name,
            isFolder: false,
            pipeline,
          });
        }
      }
    });

    const childFolderItems = Array.from(childFolders).map((folder) => ({
      label: folder.split("\\")[1],
      isFolder: true,
    }));
    return [...childFolderItems, ...childPipelines];
  }
}
