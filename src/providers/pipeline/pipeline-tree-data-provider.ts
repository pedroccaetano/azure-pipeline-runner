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
  private filteredProjects: Set<string> = new Set();
  private totalProjects: number = 0;
  private context?: vscode.ExtensionContext;
  private treeView?: vscode.TreeView<PipelineItem>;

  constructor() {}

  setContext(context: vscode.ExtensionContext, treeView: vscode.TreeView<PipelineItem>): void {
    this.context = context;
    this.treeView = treeView;
    
    // Restore filtered projects from storage
    const savedFilter = context.globalState.get<string[]>('filteredProjects');
    if (savedFilter && savedFilter.length > 0) {
      this.filteredProjects = new Set(savedFilter);
      this.updateFilterContext();
    }
  }

  refresh(): void {
    this.pipelines = [];
    this._onDidChangeTreeData.fire();
  }

  setFilteredProjects(projects: string[]): void {
    this.filteredProjects = new Set(projects);
    
    // Persist to storage
    if (this.context) {
      this.context.globalState.update('filteredProjects', projects);
    }
    
    this.updateFilterContext();
    this.refresh();
  }

  getFilteredProjects(): Set<string> {
    return this.filteredProjects;
  }

  clearFilter(): void {
    this.filteredProjects.clear();
    
    // Clear from storage
    if (this.context) {
      this.context.globalState.update('filteredProjects', undefined);
    }
    
    this.updateFilterContext();
    this.refresh();
  }

  private updateFilterContext(): void {
    const isFiltered = this.filteredProjects.size > 0;
    vscode.commands.executeCommand(
      'setContext',
      'azurePipelinesRunner.pipelinesFiltered',
      isFiltered
    );
    
    // Update tree view title
    if (this.treeView && this.totalProjects > 0) {
      if (isFiltered) {
        this.treeView.title = `Pipelines (${this.filteredProjects.size}/${this.totalProjects} filtered)`;
      } else {
        this.treeView.title = 'Pipelines';
      }
    }
  }

  getTreeItem(element: PipelineItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PipelineItem): Promise<PipelineItem[]> {
    if (!element) {
      // Top-level: Projects
      const projects = (await getProjects()) || [];
      const sortedProjects = projects.sort((a, b) => a.name.localeCompare(b.name));
      
      // Update total projects count
      this.totalProjects = sortedProjects.length;
      
      // Apply filter if any projects are filtered
      const filteredList = this.filteredProjects.size > 0
        ? sortedProjects.filter(project => this.filteredProjects.has(project.name))
        : sortedProjects;
      
      // Update title after getting projects
      this.updateFilterContext();
      
      return filteredList.map(
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
      const rootFolders = this.getRootFolders(this.pipelines).sort();
      const rootPipelines = this.getRootPipelines(this.pipelines).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
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

    const childFolderItems = Array.from(childFolders)
      .map((folder) => ({
        label: folder.split("\\")[1],
        isFolder: true,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const sortedChildPipelines = childPipelines.sort((a, b) =>
      a.label.localeCompare(b.label)
    );
    return [...childFolderItems, ...sortedChildPipelines];
  }
}
