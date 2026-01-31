import * as vscode from "vscode";
import { PipelineTreeDataProvider } from "./providers/pipeline/pipeline-tree-data-provider";
import { BuildTreeDataProvider } from "./providers/build/build-tree-data-provider";
import { StageTreeDataProvider } from "./providers/stage/stage-tree-data-provider";
import { AccountTreeDataProvider } from "./providers/account/account-tree-data-provider";
import { AccountManager } from "./services/account-manager";
import { showWelcome } from "./welcome";
import { registerCommands } from "./commands/register-commands";

export async function activate(context: vscode.ExtensionContext) {
  // Initialize account manager (singleton)
  const accountManager = AccountManager.initialize(context);

  // Attempt to migrate from legacy settings
  await accountManager.migrateFromLegacySettings();

  // Initialize tree data providers
  const accountTreeDataProvider = new AccountTreeDataProvider(accountManager);
  const pipelineTreeDataProvider = new PipelineTreeDataProvider();
  const buildTreeDataProvider = new BuildTreeDataProvider();
  const stageTreeDataProvider = new StageTreeDataProvider();

  // Register tree views
  vscode.window.registerTreeDataProvider(
    "azurePipelineAccounts",
    accountTreeDataProvider
  );
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

  // Register commands
  registerCommands(
    context,
    accountManager,
    accountTreeDataProvider,
    pipelineTreeDataProvider,
    buildTreeDataProvider,
    stageTreeDataProvider
  );

  // Check if any accounts exist
  const accounts = await accountManager.getAccounts();
  if (accounts.length === 0) {
    showWelcome();
  }
}

export function deactivate() {}
