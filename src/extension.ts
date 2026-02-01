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

  // Create tree views with programmatic control
  const accountsTreeView = vscode.window.createTreeView("azurePipelineAccounts", {
    treeDataProvider: accountTreeDataProvider,
  });
  const pipelinesTreeView = vscode.window.createTreeView("azurePipelineView", {
    treeDataProvider: pipelineTreeDataProvider,
  });
  const buildsTreeView = vscode.window.createTreeView("azurePipelineBuilds", {
    treeDataProvider: buildTreeDataProvider,
  });
  const stagesTreeView = vscode.window.createTreeView("azurePipelineStages", {
    treeDataProvider: stageTreeDataProvider,
  });

  // Store tree views in context for later use
  context.subscriptions.push(accountsTreeView, pipelinesTreeView, buildsTreeView, stagesTreeView);

  // Register commands
  registerCommands(
    context,
    accountManager,
    accountTreeDataProvider,
    pipelineTreeDataProvider,
    buildTreeDataProvider,
    stageTreeDataProvider,
    pipelinesTreeView,
    buildsTreeView,
    stagesTreeView
  );

  // Check if any accounts exist
  const accounts = await accountManager.getAccounts();

  if (accounts.length === 0) {
    showWelcome();
  }

  // Listen for account changes to refresh views
  accountManager.onDidChangeAccounts(async () => {
    const currentAccounts = await accountManager.getAccounts();
    if (currentAccounts.length > 0) {
      // Refresh pipelines view when first account is added
      await vscode.commands.executeCommand("azurePipelinesRunner.refreshEntry");
    }
  });
}



export function deactivate() {}
