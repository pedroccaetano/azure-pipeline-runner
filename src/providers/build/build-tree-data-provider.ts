import * as vscode from "vscode";
import {
  getBuildsByDefinitionId,
  getCommitMessage,
} from "../../utils/requests";
import { Build } from "../../types/builds";
import { Pipeline, Project } from "../../types/types";
import { BuildItem } from "./build-item";

export class BuildTreeDataProvider
  implements vscode.TreeDataProvider<BuildItem>, vscode.Disposable
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    BuildItem | undefined | void
  > = new vscode.EventEmitter<BuildItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<BuildItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private builds: BuildItem[] = [];
  private allBuilds: Build[] = [];
  private currentPipeline?: Pipeline;
  private currentProject?: Project;
  private pollingIntervalId: NodeJS.Timeout | undefined;
  private readonly POLLING_INTERVAL = 5000; // 5 seconds
  private configChangeListener: vscode.Disposable | undefined;

  constructor() {
    // Listen for configuration changes
    this.configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("azurePipelinesRunner.enablePolling")) {
        this.updatePollingState();
      }
    });
  }

  getCurrentPipeline(): Pipeline | undefined {
    return this.currentPipeline;
  }

  getCurrentProject(): Project | undefined {
    return this.currentProject;
  }

  refresh(): void {
    this.builds = [];
    this.stopPolling();
    this._onDidChangeTreeData.fire();
  }

  private shouldPoll(): boolean {
    const config = vscode.workspace.getConfiguration("azurePipelinesRunner");
    const pollingEnabled = config.get<boolean>("enablePolling", true);

    if (!pollingEnabled) {
      return false;
    }

    return this.builds.some((buildItem) => {
      const build = buildItem.builds?.[0];
      if (!build) {
        return false;
      }
      const status = build.status?.toLowerCase();
      return (
        status === "inprogress" ||
        status === "notstarted" ||
        status === "cancelling"
      );
    });
  }

  private startPolling(): void {
    if (this.pollingIntervalId) {
      return; // Already polling
    }

    this.pollingIntervalId = setInterval(() => {
      this.refreshBuilds();
    }, this.POLLING_INTERVAL);
    this.updateContextState(true);
  }

  private stopPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = undefined;
      this.updateContextState(false);
    }
  }

  private updatePollingState(): void {
    if (this.shouldPoll() && !this.pollingIntervalId) {
      this.startPolling();
    } else if (!this.shouldPoll() && this.pollingIntervalId) {
      this.stopPolling();
    }
  }

  private updateContextState(active: boolean): void {
    vscode.commands.executeCommand(
      "setContext",
      "azurePipelinesRunner.buildPollingActive",
      active
    );
  }

  dispose(): void {
    this.stopPolling();
    this.configChangeListener?.dispose();
  }

  getTreeItem(element: BuildItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BuildItem): Promise<BuildItem[]> {
    if (!element) {
      return this.builds;
    }
    return [];
  }

  async loadBuilds(pipeline: Pipeline, project: Project): Promise<void> {
    // CRITICAL: Stop any existing polling from previous pipeline
    this.stopPolling();

    await this.showProgress(
      `Loading builds for ${pipeline.name}`,
      async (progress) => {
        try {
          this.currentPipeline = pipeline;
          this.currentProject = project;

          const builds = await getBuildsByDefinitionId(
            project.name,
            pipeline.id
          );

          if (builds.length === 0) {
            vscode.window.showWarningMessage("No builds found!");
            return;
          }

          this.allBuilds = builds;
          const firstBuilds = builds.slice(0, 5);

          await this.appendCommitMessages(firstBuilds, project.name);

          this.builds = this.createBuildItems(firstBuilds, project, pipeline);
          this._onDidChangeTreeData.fire();
          progress.report({ increment: 100 });

          // Start polling if needed for the new pipeline
          this.updatePollingState();
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          vscode.window.showErrorMessage(
            `Failed to load builds: ${errorMessage}`
          );
        }
      }
    );
  }

  async refreshBuilds(): Promise<void> {
    // Check if polling is enabled
    const config = vscode.workspace.getConfiguration("azurePipelinesRunner");
    const pollingEnabled = config.get<boolean>("enablePolling", true);
    if (!pollingEnabled) {
      this.stopPolling();
      return;
    }

    if (this.builds.length === 0) {
      return;
    }

    const projectName = this.builds[0].project?.name as string;
    const pipelineId = this.builds[0].pipeline?.id as number;

    await this.loadBuilds(
      { id: pipelineId, name: this.builds[0].pipeline?.name } as Pipeline,
      { name: projectName } as Project
    );

    // Note: updatePollingState() is already called within loadBuilds()
  }

  async loadMoreBuilds(): Promise<void> {
    await this.showProgress(
      `Loading more builds for ${this.builds[0].pipeline?.name}`,
      async (progress) => {
        try {
          const nextBuilds = this.allBuilds.slice(
            this.builds.length,
            this.builds.length + 5
          );
          const projectName = this.builds[0].project?.name;

          await this.appendCommitMessages(nextBuilds, projectName as string);

          const buildItems = this.createBuildItems(
            nextBuilds,
            this.builds[0].project as Project,
            this.builds[0].pipeline as Pipeline
          );
          this.builds = [...this.builds, ...buildItems];
          this._onDidChangeTreeData.fire();
          progress.report({ increment: 100 });
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          vscode.window.showErrorMessage(
            `Failed to load builds: ${errorMessage}`
          );
        }
      }
    );
  }

  private async appendCommitMessages(
    builds: Build[],
    projectName: string
  ): Promise<void> {
    for (const build of builds) {
      if (build.appendCommitMessageToRunName) {
        const commitMessage = await getCommitMessage(
          projectName,
          build.repository.id,
          build.sourceVersion
        );
        build.commitMessage = commitMessage;
      }
    }
  }

  private createBuildItems(
    builds: Build[],
    project: Project,
    pipeline: Pipeline
  ): BuildItem[] {
    return builds.map(
      (build) =>
        new BuildItem(
          `#${build.buildNumber} • ${build.commitMessage?.split("\n")[0]}`,
          vscode.TreeItemCollapsibleState.None,
          "build",
          [build],
          project,
          pipeline
        )
    );
  }

  private async showProgress(
    title: string,
    task: (progress: vscode.Progress<{ increment: number }>) => Promise<void>
  ): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title,
        cancellable: false,
      },
      task
    );
  }
}
