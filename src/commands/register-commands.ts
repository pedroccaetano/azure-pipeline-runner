import * as vscode from "vscode";
import { Pipeline, Project } from "../types/types";
import { PipelineTreeDataProvider } from "../providers/pipeline/pipeline-tree-data-provider";
import { BuildTreeDataProvider } from "../providers/build/build-tree-data-provider";
import { StageTreeDataProvider } from "../providers/stage/stage-tree-data-provider";
import { Build } from "../types/builds";
import { TimelineRecord } from "../types/stages";
import { getConfiguration, getStageLog } from "../utils/requests";

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
    vscode.commands.registerCommand("azurePipelineRunner.refreshEntry", () => {
      pipelineTreeDataProvider.refresh();
      buildTreeDataProvider.refresh();
      stageTreeDataProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelineRunner.openPipeline",
      ({ pipeline }: { pipeline: Pipeline }) => {
        openExternalLink(pipeline._links.web.href);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelineRunner.openBuild",
      ({ builds }: { builds: Build[] }) => {
        const build = builds[0];
        openExternalLink(build._links.web.href);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelineRunner.openStage",
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
      "azurePipelineRunner.openStageLog",
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
    vscode.commands.registerCommand("azurePipelineRunner.showWelcome", () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "azurePipelineRunner"
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelineRunner.refreshBuilds",
      async () => {
        await buildTreeDataProvider.refreshBuilds();
        stageTreeDataProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelineRunner.loadMoreBuilds",
      async () => {
        await buildTreeDataProvider.loadMoreBuilds();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelineRunner.loadStages",
      async ({ builds, project }: { builds: Build[]; project: Project }) => {
        const build = builds[0];
        await stageTreeDataProvider.loadStages(build, project);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelineRunner.loadBuilds",
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
}
