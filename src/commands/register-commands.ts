import * as vscode from "vscode";
import { Pipeline, Project } from "../types/types";
import { PipelineTreeDataProvider } from "../providers/pipeline/pipeline-tree-data-provider";
import { BuildTreeDataProvider } from "../providers/build/build-tree-data-provider";
import { StageTreeDataProvider } from "../providers/stage/stage-tree-data-provider";
import { Build } from "../types/builds";
import { TimelineRecord } from "../types/stages";
import {
  getConfiguration,
  getStageLog,
  getRemoteBranches,
  runPipeline,
} from "../utils/requests";

const openExternalLink = (url: string) => {
  if (!url) {
    return vscode.window.showErrorMessage("Link is not available.");
  }
  vscode.env.openExternal(vscode.Uri.parse(url));
};

export function registerCommands(
  context: vscode.ExtensionContext,
  pipelineTreeDataProvider: PipelineTreeDataProvider,
  buildTreeDataProvider: BuildTreeDataProvider,
  stageTreeDataProvider: StageTreeDataProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("azurePipelinesRunner.refreshEntry", () => {
      pipelineTreeDataProvider.refresh();
      buildTreeDataProvider.refresh();
      stageTreeDataProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.openPipeline",
      ({ pipeline }: { pipeline: Pipeline }) => {
        openExternalLink(pipeline._links.web.href);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.openBuild",
      ({ builds }: { builds: Build[] }) => {
        const build = builds[0];
        openExternalLink(build._links.web.href);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.openStage",
      async ({ timelineRecord }: { timelineRecord: TimelineRecord }) => {
        const { organization } = await getConfiguration();

        let url = "";

        if (
          timelineRecord.parentId &&
          timelineRecord.state === "completed" &&
          timelineRecord.result === "succeeded"
        ) {
          url = `https://dev.azure.com/${organization}/${timelineRecord.projectName}/_build/results?buildId=${timelineRecord.buildId}&view=logs&j=${timelineRecord.parentId}&t=${timelineRecord.id}`;
        } else if (
          timelineRecord.parentId &&
          timelineRecord.result === "skipped"
        ) {
          url = `https://dev.azure.com/${organization}/${timelineRecord.projectName}/_build/results?buildId=${timelineRecord.buildId}&view=logs&j=${timelineRecord.id}`;
        } else {
          url = `https://dev.azure.com/${organization}/${timelineRecord.projectName}/_build/results?buildId=${timelineRecord.buildId}&view=logs&s=${timelineRecord.id}`;
        }

        openExternalLink(url);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.openStageLog",
      async ({ timelineRecord }: { timelineRecord: TimelineRecord }) => {
        try {
          const url = timelineRecord.log?.url;
          if (!url) {
            vscode.window.showInformationMessage("Log URL is not available.");
            return;
          }

          const logContent = await getStageLog(url);
          const formattedLog = logContent.value
            .map((line) => line.slice(29))
            .join("\n");
          const document = await vscode.workspace.openTextDocument({
            content: formattedLog,
            language: "plaintext",
          });

          await vscode.window.showTextDocument(document);
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          vscode.window.showErrorMessage(
            `Failed to load stage log: ${errorMessage}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("azurePipelinesRunner.showWelcome", () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "azurePipelinesRunner"
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.refreshBuilds",
      async () => {
        await buildTreeDataProvider.refreshBuilds();
        stageTreeDataProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.loadMoreBuilds",
      async () => {
        await buildTreeDataProvider.loadMoreBuilds();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.refreshStages",
      async () => {
        await stageTreeDataProvider.refreshStages();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.loadStages",
      async ({ builds, project }: { builds: Build[]; project: Project }) => {
        const build = builds[0];
        await stageTreeDataProvider.loadStages(build, project);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.loadBuilds",
      async ({
        pipeline,
        project,
      }: {
        pipeline: Pipeline;
        project: Project;
      }) => {
        stageTreeDataProvider.refresh();
        buildTreeDataProvider.refresh();
        await buildTreeDataProvider.loadBuilds(pipeline, project);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.runPipelineFromBranch",
      async () => {
        try {
          const currentPipeline = buildTreeDataProvider.getCurrentPipeline();
          const currentProject = buildTreeDataProvider.getCurrentProject();

          if (!currentPipeline || !currentProject) {
            vscode.window.showErrorMessage(
              "Please select a pipeline first to run a build."
            );
            return;
          }

          // Get the repository ID from the first build
          const builds = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Window,
              title: "Fetching repository information...",
              cancellable: false,
            },
            async () => {
              const { getBuildsByDefinitionId } = await import(
                "../utils/requests.js"
              );
              return await getBuildsByDefinitionId(
                currentProject.name,
                currentPipeline.id
              );
            }
          );

          if (builds.length === 0) {
            vscode.window.showErrorMessage(
              "No builds found to determine repository."
            );
            return;
          }

          const repositoryId = builds[0].repository.id;

          // Fetch remote branches
          const branches = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Window,
              title: "Fetching remote branches...",
              cancellable: false,
            },
            async () => {
              return await getRemoteBranches(
                currentProject.name,
                repositoryId
              );
            }
          );

          if (branches.length === 0) {
            vscode.window.showErrorMessage(
              "No branches found for this repository."
            );
            return;
          }

          // Show branch picker
          const selectedBranch = await vscode.window.showQuickPick(branches, {
            placeHolder: "Select a branch to run the pipeline",
            title: "Run Pipeline from Branch",
          });

          if (!selectedBranch) {
            return; // User cancelled
          }

          // Trigger pipeline run
          const result = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Running pipeline on branch: ${selectedBranch}`,
              cancellable: false,
            },
            async () => {
              return await runPipeline(
                currentProject.name,
                currentPipeline.id,
                selectedBranch
              );
            }
          );

          if (result) {
            vscode.window.showInformationMessage(
              `Pipeline run successfully triggered for branch: ${selectedBranch}`
            );
            // Refresh builds list with retry to ensure new build appears
            const maxRetries = 5;
            const retryDelay = 1000; // 1 second
            
            for (let i = 0; i < maxRetries; i++) {
              await buildTreeDataProvider.refreshBuilds();
              
              // Check if the new build appears in the list by importing and checking
              const { getBuildsByDefinitionId } = await import(
                "../utils/requests.js"
              );
              const builds = await getBuildsByDefinitionId(
                currentProject.name,
                currentPipeline.id
              );
              
              // Look for the newly created build
              const newBuild = builds.find((b) => b.id === result.id);
              
              if (newBuild && (newBuild.status || newBuild.result)) {
                // Build found with status, we're done
                break;
              }
              
              // If not found or no status yet, wait before retrying (except on last iteration)
              if (i < maxRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
              }
            }
          }
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          vscode.window.showErrorMessage(
            `Failed to run pipeline: ${errorMessage}`
          );
        }
      }
    )
  );
}
