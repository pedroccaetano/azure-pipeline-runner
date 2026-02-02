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
  context.subscriptions.push(
    accountsTreeView,
    pipelinesTreeView,
    buildsTreeView,
    stagesTreeView,
    buildTreeDataProvider,
    stageTreeDataProvider
  );

  // Listen for view visibility changes to pause/resume polling
  context.subscriptions.push(
    buildsTreeView.onDidChangeVisibility((e) => {
      buildTreeDataProvider.setViewVisible(e.visible);
    }),
    stagesTreeView.onDidChangeVisibility((e) => {
      stageTreeDataProvider.setViewVisible(e.visible);
    })
  );

  // Initialize polling context states (both start as inactive/false)
  vscode.commands.executeCommand(
    "setContext",
    "azurePipelinesRunner.buildPollingActive",
    false
  );
  vscode.commands.executeCommand(
    "setContext",
    "azurePipelinesRunner.stagePollingActive",
    false
  );

  // Create output channel for pipeline logs
  const outputChannel = vscode.window.createOutputChannel("Azure Pipeline Logs");
  context.subscriptions.push(outputChannel);

  // Create status bar item for polling toggle
  const pollingStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  pollingStatusBarItem.command = "azurePipelinesRunner.togglePolling";
  pollingStatusBarItem.tooltip = "Toggle Azure Pipelines Polling";
  updatePollingStatusBar(pollingStatusBarItem);
  pollingStatusBarItem.show();
  context.subscriptions.push(pollingStatusBarItem);

  // Listen for configuration changes to update status bar
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("azurePipelinesRunner.enablePolling")) {
        updatePollingStatusBar(pollingStatusBarItem);
      }
    })
  );

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
    stagesTreeView,
    outputChannel
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



function updatePollingStatusBar(statusBarItem: vscode.StatusBarItem) {
  const config = vscode.workspace.getConfiguration("azurePipelinesRunner");
  const isEnabled = config.get<boolean>("enablePolling", true);

  if (isEnabled) {
    statusBarItem.text = "$(sync)";
    statusBarItem.tooltip = "Azure Pipelines Polling: Enabled (Click to disable)";
  } else {
    statusBarItem.text = "$(sync-ignored)";
    statusBarItem.tooltip = "Azure Pipelines Polling: Disabled (Click to enable)";
  }
  
  statusBarItem.show();
}

export function deactivate() {}
