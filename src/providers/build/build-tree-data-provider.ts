import * as vscode from "vscode";
import {
  getBuildsByDefinitionId,
  getCommitMessage,
  getRetentionLeases,
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
  private configChangeListener: vscode.Disposable | undefined;
  private isViewVisible: boolean = true;
  private isManualRefresh: boolean = false;

  constructor() {
    // Listen for configuration changes
    this.configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("azurePipelinesRunner.enablePolling") ||
          e.affectsConfiguration("azurePipelinesRunner.pollingIntervalSeconds")) {
        this.updatePollingState();
      }
    });
  }

  setViewVisible(visible: boolean): void {
    this.isViewVisible = visible;
    this.updatePollingState();
  }

  pausePolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = undefined;
    }
  }

  resumePolling(): void {
    if (this.shouldPoll() && !this.pollingIntervalId) {
      this.startPolling();
    }
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

    if (!pollingEnabled || !this.isViewVisible) {
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

    const config = vscode.workspace.getConfiguration("azurePipelinesRunner");
    const intervalSeconds = config.get<number>("pollingIntervalSeconds", 5);
    const intervalMs = intervalSeconds * 1000;

    this.pollingIntervalId = setInterval(() => {
      this.refreshBuilds(false);
    }, intervalMs);
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
    // If interval changed while polling, restart with new interval
    if (this.pollingIntervalId) {
      this.stopPolling();
    }

    if (this.shouldPoll()) {
      this.startPolling();
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
    this.isManualRefresh = true;

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
            this.isManualRefresh = false;
            return;
          }

          this.allBuilds = builds;
          const firstBuilds = builds.slice(0, 5);

          await this.appendCommitMessages(firstBuilds, project.name);

          // Fetch retention leases for manual refresh
          if (this.isManualRefresh) {
            await this.fetchRetentionLeases(firstBuilds, project.name);
          }

          this.builds = this.createBuildItems(firstBuilds, project, pipeline);
          this._onDidChangeTreeData.fire();
          progress.report({ increment: 100 });

          this.isManualRefresh = false;

          // Start polling if needed for the new pipeline
          this.updatePollingState();
        } catch (error) {
          this.isManualRefresh = false;
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

  async refreshBuilds(isManual: boolean = false): Promise<void> {
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

    // Set the manual refresh flag
    this.isManualRefresh = isManual;

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

          // Fetch retention leases for newly loaded builds
          await this.fetchRetentionLeases(nextBuilds, projectName as string);

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
          build.id
        );
        build.commitMessage = commitMessage;
      }
    }
  }

  private async fetchRetentionLeases(
    builds: Build[],
    projectName: string
  ): Promise<void> {
    for (const build of builds) {
      try {
        const leases = await getRetentionLeases(projectName, build.id);
        build.retentionLeases = leases;
      } catch (error) {
        // Silently ignore errors, just don't set retention leases
        build.retentionLeases = [];
      }
    }
  }

  private createBuildItems(
    builds: Build[],
    project: Project,
    pipeline: Pipeline
  ): BuildItem[] {
    return builds.map((build) => {
      const label = `#${build.buildNumber} • ${build.commitMessage?.split("\n")[0]}`;
      const isPinned = build.retentionLeases && build.retentionLeases.length > 0;
      
      return new BuildItem(
        label,
        vscode.TreeItemCollapsibleState.None,
        isPinned ? "build-pinned" : "build",
        [build],
        project,
        pipeline
      );
    });
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
