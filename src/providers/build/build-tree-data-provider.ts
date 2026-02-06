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
  private isLoading: boolean = false;
  private isLoadingMore: boolean = false;

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
      if (this.isLoading) {
        return [
          new BuildItem(
            "Loading builds...",
            vscode.TreeItemCollapsibleState.None,
            "loading",
            undefined,
            undefined,
            undefined
          ),
        ];
      }
      
      // Add "Load more..." item or loading spinner if there are more builds available
      if (this.builds.length > 0 && this.builds.length < this.allBuilds.length) {
        if (this.isLoadingMore) {
          const loadingItem = new BuildItem(
            "Loading more builds...",
            vscode.TreeItemCollapsibleState.None,
            "loading",
            undefined,
            undefined,
            undefined
          );
          return [...this.builds, loadingItem];
        } else {
          const loadMoreItem = new BuildItem(
            "Load more...",
            vscode.TreeItemCollapsibleState.None,
            "load-more",
            undefined,
            undefined,
            undefined
          );
          loadMoreItem.command = {
            command: "azurePipelinesRunner.loadMoreBuilds",
            title: "Load More Builds",
          };
          return [...this.builds, loadMoreItem];
        }
      }
      
      return this.builds;
    }
    return [];
  }

  async loadBuilds(pipeline: Pipeline, project: Project): Promise<void> {
    // CRITICAL: Stop any existing polling from previous pipeline
    this.stopPolling();
    this.isManualRefresh = true;

    // Show loading indicator in tree view
    this.isLoading = true;
    this.builds = [];
    this._onDidChangeTreeData.fire();

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
            this.isLoading = false;
            this._onDidChangeTreeData.fire();
            vscode.window.showWarningMessage("No builds found!");
            this.isManualRefresh = false;
            return;
          }

          this.allBuilds = builds;
          const config = vscode.workspace.getConfiguration("azurePipelinesRunner");
          const buildsPerPage = config.get<number>("buildsPerPage", 5);
          const firstBuilds = builds.slice(0, buildsPerPage);

          await this.appendCommitMessages(firstBuilds, project.name);

          // Fetch retention leases for manual refresh
          if (this.isManualRefresh) {
            await this.fetchRetentionLeases(firstBuilds, project.name);
          }

          this.builds = this.createBuildItems(firstBuilds, project, pipeline);
          this.isLoading = false;
          this._onDidChangeTreeData.fire();
          progress.report({ increment: 100 });

          this.isManualRefresh = false;

          // Start polling if needed for the new pipeline
          this.updatePollingState();
        } catch (error) {
          this.isLoading = false;
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

    if (this.builds.length === 0 || !this.currentPipeline || !this.currentProject) {
      return;
    }

    // Set the manual refresh flag
    this.isManualRefresh = isManual;

    try {
      // Get all builds to update the allBuilds cache
      const allBuilds = await getBuildsByDefinitionId(
        this.currentProject.name,
        this.currentPipeline.id
      );
      this.allBuilds = allBuilds;

      // Only update the builds currently displayed
      const currentCount = this.builds.length;
      const buildsToUpdate = allBuilds.slice(0, currentCount);

      await this.appendCommitMessages(buildsToUpdate, this.currentProject.name);

      // Fetch retention leases only on manual refresh
      if (this.isManualRefresh) {
        await this.fetchRetentionLeases(buildsToUpdate, this.currentProject.name);
      }

      this.builds = this.createBuildItems(
        buildsToUpdate,
        this.currentProject,
        this.currentPipeline
      );
      this._onDidChangeTreeData.fire();

      this.isManualRefresh = false;

      // Update polling state based on current builds
      this.updatePollingState();
    } catch (error) {
      this.isManualRefresh = false;
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      vscode.window.showErrorMessage(
        `Failed to refresh builds: ${errorMessage}`
      );
    }
  }

  async loadMoreBuilds(): Promise<void> {
    this.isLoadingMore = true;
    this._onDidChangeTreeData.fire();

    try {
      const config = vscode.workspace.getConfiguration("azurePipelinesRunner");
      const buildsPerPage = config.get<number>("buildsPerPage", 5);
      const nextBuilds = this.allBuilds.slice(
        this.builds.length,
        this.builds.length + buildsPerPage
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
      this.isLoadingMore = false;
      this._onDidChangeTreeData.fire();
    } catch (error) {
      this.isLoadingMore = false;
      this._onDidChangeTreeData.fire();
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      vscode.window.showErrorMessage(
        `Failed to load more builds: ${errorMessage}`
      );
    }
  }

  private async appendCommitMessages(
    builds: Build[],
    projectName: string
  ): Promise<void> {
    const buildsNeedingCommit = builds.filter(b => b.appendCommitMessageToRunName);
    await Promise.all(
      buildsNeedingCommit.map(async (build) => {
        const commitMessage = await getCommitMessage(projectName, build.id);
        build.commitMessage = commitMessage;
      })
    );
  }

  private async fetchRetentionLeases(
    builds: Build[],
    projectName: string
  ): Promise<void> {
    await Promise.all(
      builds.map(async (build) => {
        try {
          const leases = await getRetentionLeases(projectName, build.id);
          build.retentionLeases = leases;
        } catch (error) {
          // Silently ignore errors, just don't set retention leases
          build.retentionLeases = [];
        }
      })
    );
  }

  private createBuildItems(
    builds: Build[],
    project: Project,
    pipeline: Pipeline
  ): BuildItem[] {
    return builds.map((build) => {
      const label = `#${build.buildNumber} • ${build.commitMessage?.split("\n")[0]}`;
      const isPinned = build.retentionLeases && build.retentionLeases.length > 0;
      const status = build.status?.toLowerCase();
      const isRunning = status === "inprogress" || status === "notstarted" || status === "cancelling";
      
      let contextValue: string;
      if (isRunning) {
        contextValue = isPinned ? "build-running-pinned" : "build-running";
      } else {
        contextValue = isPinned ? "build-pinned" : "build";
      }
      
      return new BuildItem(
        label,
        vscode.TreeItemCollapsibleState.None,
        contextValue,
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
