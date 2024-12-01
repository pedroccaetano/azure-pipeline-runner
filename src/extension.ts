import * as vscode from "vscode";
import { PipelineTreeDataProvider } from "./providers/pipeline/pipeline-tree-data-provider";
import { BuildTreeDataProvider } from "./providers/build/build-tree-data-provider";
import { StageTreeDataProvider } from "./providers/stage/stage-tree-data-provider";
import { showWelcome } from "./welcome";
import { register } from "module";
import { registerCommands } from "./commands/register-commands";

const pipelineTreeDataProvider = new PipelineTreeDataProvider();
const buildTreeDataProvider = new BuildTreeDataProvider();
const stageTreeDataProvider = new StageTreeDataProvider();

export function activate(context: vscode.ExtensionContext) {
  vscode.window.registerTreeDataProvider(
    "azurePipelineView",
    pipelineTreeDataProvider
  );
  vscode.window.registerTreeDataProvider(
    "azurePipelineBuilds",
    buildTreeDataProvider
  );
  vscode.window.registerTreeDataProvider(
    "azurePipelineStages",
    stageTreeDataProvider
  );

  registerCommands(
    context,
    pipelineTreeDataProvider,
    buildTreeDataProvider,
    stageTreeDataProvider
  );

  const organization = vscode.workspace
    .getConfiguration()
    .get("azurePipelineRunner.organization");
  const pat = vscode.workspace
    .getConfiguration()
    .get("azurePipelineRunner.pat");
  if (!organization || !pat) {
    showWelcome();
  }
}

export function deactivate() {}
