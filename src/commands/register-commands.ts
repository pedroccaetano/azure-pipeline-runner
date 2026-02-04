import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Pipeline, Project, TemplateParameters } from "../types/types";
import { PipelineTreeDataProvider } from "../providers/pipeline/pipeline-tree-data-provider";
import { BuildTreeDataProvider } from "../providers/build/build-tree-data-provider";
import { StageTreeDataProvider } from "../providers/stage/stage-tree-data-provider";
import { AccountTreeDataProvider } from "../providers/account/account-tree-data-provider";
import { AccountManager } from "../services/account-manager";
import { AccountData } from "../types/account";
import { Build } from "../types/builds";
import { TimelineRecord } from "../types/stages";
import {
  getConfiguration,
  getStageLog,
  getRemoteBranches,
  runPipeline,
  getPipelineDefinition,
  getPipelineYaml,
  parseYamlParameters,
  getPipelineRun,
  getProjects,
  deleteBuild,
  retainBuild,
  cancelBuild,
} from "../utils/requests";
import { collectParameterValues } from "../utils/parameter-prompt";

const openExternalLink = (url: string) => {
  if (!url) {
    return vscode.window.showErrorMessage("Link is not available.");
  }
  vscode.env.openExternal(vscode.Uri.parse(url));
};

export function registerCommands(
  context: vscode.ExtensionContext,
  accountManager: AccountManager,
  accountTreeDataProvider: AccountTreeDataProvider,
  pipelineTreeDataProvider: PipelineTreeDataProvider,
  buildTreeDataProvider: BuildTreeDataProvider,
  stageTreeDataProvider: StageTreeDataProvider,
  pipelinesTreeView?: vscode.TreeView<unknown>,
  buildsTreeView?: vscode.TreeView<unknown>,
  stagesTreeView?: vscode.TreeView<unknown>,
  outputChannel?: vscode.OutputChannel
) {
  // Account Commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.addAccount",
      async () => {
        try {
          const organization = await vscode.window.showInputBox({
            prompt: "Enter your Azure DevOps organization name",
            placeHolder: "Organization name",
            validateInput: (value) => {
              if (!value || value.trim() === "") {
                return "Organization name is required";
              }
              return null;
            },
          });

          if (!organization) {
            return;
          }

          const pat = await vscode.window.showInputBox({
            prompt: "Enter your Personal Access Token (PAT)",
            placeHolder: "PAT",
            password: true,
            validateInput: (value) => {
              if (!value || value.trim() === "") {
                return "PAT is required";
              }
              return null;
            },
          });

          if (!pat) {
            return;
          }

          const note = await vscode.window.showInputBox({
            prompt: "Enter a note to identify this account (optional)",
            placeHolder: "e.g., Work PAT, Personal, Prod Access",
          });

          const newAccount = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Validating credentials...",
              cancellable: false,
            },
            async () => {
              return await accountManager.addAccount(organization.trim(), pat.trim(), note?.trim() || "");
            }
          );

          // Automatically switch to the newly added account
          await accountManager.setActiveAccount(newAccount.id);

          vscode.window.showInformationMessage(
            `Account added and switched to ${organization}`
          );

          // Refresh all views
          accountTreeDataProvider.refresh();
          pipelineTreeDataProvider.refresh();

          // Expand and focus Pipelines view
          if (pipelinesTreeView) {
            try {
              await vscode.commands.executeCommand("azurePipelineView.focus");
            } catch (error) {
              // Silently fail if command doesn't work
            }
          }
          buildTreeDataProvider.refresh();
          stageTreeDataProvider.refresh();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to add account: ${message}`);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.switchAccount",
      async (account: AccountData) => {
        try {
          await accountManager.setActiveAccount(account.id);
          vscode.window.showInformationMessage(
            `Switched to ${account.organization} (${account.username})`
          );

          // Refresh all views
          accountTreeDataProvider.refresh();
          pipelineTreeDataProvider.refresh();
          buildTreeDataProvider.refresh();
          stageTreeDataProvider.refresh();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to switch account: ${message}`);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.editAccountNote",
      async (item: { account: AccountData }) => {
        try {
          const account = item.account;
          const newNote = await vscode.window.showInputBox({
            prompt: "Enter a new note for this account",
            placeHolder: "e.g., Work PAT, Personal, Prod Access",
            value: account.note,
          });

          if (newNote === undefined) {
            return; // User cancelled
          }

          await accountManager.updateAccount(account.id, { note: newNote.trim() });
          vscode.window.showInformationMessage("Account note updated");
          accountTreeDataProvider.refresh();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to update note: ${message}`);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.deleteAccount",
      async (item: { account: AccountData }) => {
        try {
          const account = item.account;
          const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the account for "${account.organization}" (${account.username})?`,
            { modal: true },
            "Delete"
          );

          if (confirm !== "Delete") {
            return;
          }

          await accountManager.deleteAccount(account.id);
          vscode.window.showInformationMessage("Account deleted");

          // Refresh all views
          accountTreeDataProvider.refresh();
          pipelineTreeDataProvider.refresh();
          buildTreeDataProvider.refresh();
          stageTreeDataProvider.refresh();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to delete account: ${message}`);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.refreshAccounts",
      () => {
        accountTreeDataProvider.refresh();
      }
    )
  );

  // Existing commands
  context.subscriptions.push(
    vscode.commands.registerCommand("azurePipelinesRunner.refreshEntry", () => {
      pipelineTreeDataProvider.refresh();
      buildTreeDataProvider.refresh();
      stageTreeDataProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.filterPipelines",
      async () => {
        try {
          // Get all projects
          const projects = (await getProjects()) || [];
          
          // Edge case: No projects available
          if (projects.length === 0) {
            vscode.window.showInformationMessage("No projects available to filter.");
            return;
          }

          // Get current filter
          const currentFilter = pipelineTreeDataProvider.getFilteredProjects();
          
          // Create quick pick items with current selection
          const quickPickItems = projects
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((project) => ({
              label: project.name,
              picked: currentFilter.size === 0 || currentFilter.has(project.name),
              project,
            }));

          // Show quick pick with multi-select
          const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
            canPickMany: true,
            placeHolder: "Select projects to show (all selected by default)",
            title: "Filter Pipelines by Project",
          });

          // Edge case: User cancelled
          if (selectedItems === undefined) {
            return;
          }

          // Edge case: No projects selected - show a warning
          if (selectedItems.length === 0) {
            const confirm = await vscode.window.showWarningMessage(
              "No projects selected. This will hide all pipelines. Continue?",
              { modal: true },
              "Yes",
              "No"
            );

            if (confirm !== "Yes") {
              return;
            }
          }

          // Update filter
          if (selectedItems.length === projects.length) {
            // All projects selected - clear filter to show all
            pipelineTreeDataProvider.clearFilter();
            vscode.window.showInformationMessage("Filter cleared - showing all projects.");
          } else {
            // Apply filter
            const selectedProjectNames = selectedItems.map((item) => item.label);
            pipelineTreeDataProvider.setFilteredProjects(selectedProjectNames);
            
            const projectsText = selectedProjectNames.length === 1
              ? "1 project"
              : `${selectedProjectNames.length} projects`;
            vscode.window.showInformationMessage(`Filter applied - showing ${projectsText}.`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to filter pipelines: ${message}`);
        }
      }
    )
  );

  // Register the same command for the active (filled) icon state
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.filterPipelinesActive",
      async () => {
        // Delegate to the same logic
        await vscode.commands.executeCommand("azurePipelinesRunner.filterPipelines");
      }
    )
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
          const formattedLog = logContent.value.map((line) => line.slice(29));

          // Get the configured log viewer preference
          const config = vscode.workspace.getConfiguration("azurePipelinesRunner");
          const logViewer = config.get<string>("logViewer", "outputChannel");

          if (logViewer === "file") {
            // Save to temporary file and open in editor
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const sanitizedStageName = (timelineRecord.name || "Unknown")
              .replace(/[^a-zA-Z0-9_-]/g, "_")
              .substring(0, 50);
            const fileName = `stage-log-${sanitizedStageName}-${timestamp}.log`;
            const tempFilePath = path.join(os.tmpdir(), fileName);

            const logText = [
              `=== Stage Log: ${timelineRecord.name || "Unknown"} ===`,
              `=== Build ID: ${timelineRecord.buildId} ===`,
              `=== Timestamp: ${new Date().toLocaleString()} ===`,
              "",
              ...formattedLog,
            ].join("\n");

            fs.writeFileSync(tempFilePath, logText, "utf-8");

            const doc = await vscode.workspace.openTextDocument(tempFilePath);
            await vscode.window.showTextDocument(doc, { preview: false });
          } else {
            // Use Output Channel (default)
            if (!outputChannel) {
              vscode.window.showErrorMessage("Output channel is not available.");
              return;
            }

            outputChannel.clear();
            outputChannel.appendLine(`=== Stage Log: ${timelineRecord.name || "Unknown"} ===`);
            outputChannel.appendLine("");
            formattedLog.forEach((line) => outputChannel.appendLine(line));
            outputChannel.show();
          }
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
    vscode.commands.registerCommand(
      "azurePipelinesRunner.retryStage",
      async ({ timelineRecord }: { timelineRecord: TimelineRecord }) => {
        try {
          // Validate that this is a Stage
          if (timelineRecord.type !== "Stage") {
            vscode.window.showErrorMessage(
              "Retry is only available for stages."
            );
            return;
          }

          // Validate that stage has an identifier
          if (!timelineRecord.identifier) {
            vscode.window.showErrorMessage(
              "Stage identifier is not available. Cannot retry this stage."
            );
            return;
          }

          // Get all records for checkpoint detection
          const allRecords = stageTreeDataProvider.getAllRecords();
          
          // Import the retry service
          const { handleStageRetry } = await import("../services/stage-retry-service.js");
          
          // Handle the retry
          await handleStageRetry(
            timelineRecord.projectName,
            timelineRecord.buildId,
            timelineRecord.id,
            timelineRecord.identifier,
            timelineRecord.name,
            allRecords
          );
          
          // Refresh the stages tree after retry
          setTimeout(() => {
            stageTreeDataProvider.refreshStages();
          }, 2000);
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          vscode.window.showErrorMessage(
            `Failed to retry stage: ${errorMessage}`
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

  // Approve Stage Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.approveStage",
      async ({ timelineRecord }: { timelineRecord: TimelineRecord }) => {
        try {
          // Get current account
          const accounts = await accountManager.getAccounts();
          const activeAccount = accounts.find((a) => a.isActive);
          
          if (!activeAccount) {
            vscode.window.showErrorMessage(
              "No active account. Please add and activate an account first."
            );
            return;
          }

          // Get project and build context from the stage tree data provider
          const project = stageTreeDataProvider.getCurrentProject();
          const build = stageTreeDataProvider.getCurrentBuild();

          if (!project || !build) {
            vscode.window.showErrorMessage(
              "Unable to determine project or build context."
            );
            return;
          }

          // Get the approval ID for this stage
          const approvalId = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Fetching approval details...",
              cancellable: false,
            },
            async () => {
              const { getApprovalIdForStage } = await import(
                "../utils/approval-detection.js"
              );
              return await getApprovalIdForStage(
                activeAccount.organization,
                project.name,
                build.id,
                timelineRecord.id,
                activeAccount.pat
              );
            }
          );

          if (!approvalId) {
            vscode.window.showErrorMessage(
              "Unable to find approval ID for this stage. The stage might not require approval."
            );
            return;
          }

          // Show QuickPick for approve/reject decision
          const decision = await vscode.window.showQuickPick(
            [
              {
                label: "$(check) Approve",
                description: "Approve this stage to continue the pipeline",
                value: "approve"
              },
              {
                label: "$(x) Reject",
                description: "Reject this stage and fail the pipeline",
                value: "reject"
              }
            ],
            {
              placeHolder: `Choose action for stage: ${timelineRecord.name}`,
              title: "Stage Approval"
            }
          );

          if (!decision) {
            return; // User cancelled
          }

          // Prompt for optional comment
          const comment = await vscode.window.showInputBox({
            prompt: "Enter an optional comment (press Enter to skip)",
            placeHolder: "Optional comment",
            value: ""
          });

          if (comment === undefined) {
            return; // User cancelled
          }

          // Perform the approval/rejection
          const actionText = decision.value === "approve" ? "Approving" : "Rejecting";
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `${actionText} stage: ${timelineRecord.name}...`,
              cancellable: false,
            },
            async () => {
              const { approveStage, rejectStage } = await import(
                "../services/approval-service.js"
              );

              if (decision.value === "approve") {
                await approveStage(
                  activeAccount.organization,
                  project.name,
                  approvalId,
                  comment,
                  activeAccount.pat
                );
              } else {
                await rejectStage(
                  activeAccount.organization,
                  project.name,
                  approvalId,
                  comment,
                  activeAccount.pat
                );
              }
            }
          );

          const actionPast = decision.value === "approve" ? "approved" : "rejected";
          vscode.window.showInformationMessage(
            `Stage "${timelineRecord.name}" ${actionPast} successfully`
          );

          // Refresh the stage tree to show updated status
          setTimeout(() => {
            stageTreeDataProvider.refreshStages();
          }, 1000); // Give API a moment to update
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(
            `Failed to process stage approval: ${message}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.toggleLogViewer",
      async () => {
        const config = vscode.workspace.getConfiguration("azurePipelinesRunner");
        const currentViewer = config.get<string>("logViewer", "outputChannel");

        const options = [
          {
            label: "$(output) Output Channel",
            description: currentViewer === "outputChannel" ? "(Current)" : "",
            detail: "Open logs in the Output Channel panel",
            value: "outputChannel"
          },
          {
            label: "$(file-code) File Editor",
            description: currentViewer === "file" ? "(Current)" : "",
            detail: "Save logs to a temporary file and open in editor",
            value: "file"
          }
        ];

        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: "Choose how to view stage logs",
          title: "Log Viewer Settings"
        });

        if (selected && selected.value !== currentViewer) {
          await config.update("logViewer", selected.value, vscode.ConfigurationTarget.Global);
          const viewerName = selected.value === "outputChannel" ? "Output Channel" : "File Editor";
          vscode.window.showInformationMessage(
            `Stage logs will now open in: ${viewerName}`
          );
        }
      }
    )
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
        
        // Expand and focus Stages view
        if (stagesTreeView) {
          try {
            await vscode.commands.executeCommand("azurePipelineStages.focus");
          } catch (error) {
            // Silently fail if command doesn't work
          }
        }
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
        
        // Expand and focus Builds view
        if (buildsTreeView) {
          try {
            await vscode.commands.executeCommand("azurePipelineBuilds.focus");
          } catch (error) {
            // Silently fail if command doesn't work
          }
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.retriggerBuild",
      async ({ builds, project }: { builds: Build[]; project: Project }) => {
        try {
          const build = builds[0];
          if (!build) {
            vscode.window.showErrorMessage("No build found to retrigger.");
            return;
          }

          const pipelineId = build.definition.id;
          const branch = build.sourceBranch.replace("refs/heads/", "");

          // Try to get the original run's template parameters
          let templateParameters: TemplateParameters = {};
          const pipelineRun = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Window,
              title: "Fetching build parameters...",
              cancellable: false,
            },
            async () => {
              return await getPipelineRun(project.name, pipelineId, build.id);
            }
          );

          if (pipelineRun?.templateParameters) {
            templateParameters = pipelineRun.templateParameters;
          }

          // Trigger pipeline run with the same parameters
          const result = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Retriggering build on branch: ${branch}`,
              cancellable: false,
            },
            async () => {
              return await runPipeline(
                project.name,
                pipelineId,
                branch,
                templateParameters
              );
            }
          );

          if (result) {
            vscode.window.showInformationMessage(
              `Build successfully retriggered on branch: ${branch}`
            );
            // Refresh builds list
            await buildTreeDataProvider.refreshBuilds();
          }
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          vscode.window.showErrorMessage(
            `Failed to retrigger build: ${errorMessage}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.deleteBuild",
      async ({ builds, project }: { builds: Build[]; project: Project }) => {
        try {
          const build = builds[0];
          if (!build) {
            vscode.window.showErrorMessage("No build found to delete.");
            return;
          }

          const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to delete build #${build.buildNumber}?`,
            { modal: true },
            "Delete",
            "Cancel"
          );

          if (confirmation !== "Delete") {
            return;
          }

          const success = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Deleting build #${build.buildNumber}...`,
              cancellable: false,
            },
            async () => {
              return await deleteBuild(project.name, build.id);
            }
          );

          if (success) {
            vscode.window.showInformationMessage(
              `Build #${build.buildNumber} successfully deleted`
            );
            // Refresh builds list
            await buildTreeDataProvider.refreshBuilds();
          }
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          vscode.window.showErrorMessage(
            `Failed to delete build: ${errorMessage}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.cancelBuild",
      async ({ builds, project }: { builds: Build[]; project: Project }) => {
        try {
          const build = builds[0];
          if (!build) {
            vscode.window.showErrorMessage("No build found to cancel.");
            return;
          }

          if (build.status !== "inProgress" && build.status !== "notStarted") {
            vscode.window.showWarningMessage(
              `Build #${build.buildNumber} is not in progress and cannot be cancelled.`
            );
            return;
          }

          const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to cancel build #${build.buildNumber}?`,
            { modal: true },
            "Cancel Build",
            "No"
          );

          if (confirmation !== "Cancel Build") {
            return;
          }

          const success = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Cancelling build #${build.buildNumber}...`,
              cancellable: false,
            },
            async () => {
              return await cancelBuild(project.name, build.id);
            }
          );

          if (success) {
            vscode.window.showInformationMessage(
              `Build #${build.buildNumber} is being cancelled`
            );
            // Refresh builds list
            await buildTreeDataProvider.refreshBuilds();
          }
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          vscode.window.showErrorMessage(
            `Failed to cancel build: ${errorMessage}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.retainBuild",
      async ({ builds, project }: { builds: Build[]; project: Project }) => {
        try {
          const build = builds[0];
          if (!build) {
            vscode.window.showErrorMessage("No build found to retain.");
            return;
          }

          const action = await vscode.window.showQuickPick(
            [
              { label: "Retain indefinitely", value: true },
              { label: "Remove retention", value: false },
            ],
            {
              placeHolder: "Choose retention action",
            }
          );

          if (!action) {
            return;
          }

          const success = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: action.value
                ? `Retaining build #${build.buildNumber}...`
                : `Removing retention from build #${build.buildNumber}...`,
              cancellable: false,
            },
            async () => {
              return await retainBuild(project.name, build.id, build.definition.id, action.value);
            }
          );

          if (success) {
            vscode.window.showInformationMessage(
              action.value
                ? `Build #${build.buildNumber} will be retained indefinitely`
                : `Retention removed from build #${build.buildNumber}`
            );
            // Refresh builds list
            await buildTreeDataProvider.refreshBuilds();
          }
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          vscode.window.showErrorMessage(
            `Failed to update build retention: ${errorMessage}`
          );
        }
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

          // Fetch pipeline definition and parameters
          const pipelineDefinition = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Window,
              title: "Fetching pipeline parameters...",
              cancellable: false,
            },
            async () => {
              return await getPipelineDefinition(
                currentProject.name,
                currentPipeline.id
              );
            }
          );

          let templateParameters = {};

          if (pipelineDefinition?.configuration) {
            // Try to fetch and parse YAML for parameters
            const yamlPath = pipelineDefinition.configuration.path;
            const repoId =
              pipelineDefinition.configuration.repository?.id || repositoryId;

            console.log("Pipeline configuration found - YAML path:", yamlPath, "Repo ID:", repoId);

            if (yamlPath && repoId) {
              const yamlContent = await getPipelineYaml(
                currentProject.name,
                repoId,
                yamlPath,
                selectedBranch
              );

              if (yamlContent) {
                console.log("YAML file fetched successfully, length:", yamlContent.length);
                console.log("YAML path:", yamlPath);
                console.log("YAML content preview:", yamlContent.substring(0, 500));
                
                const parameters = parseYamlParameters(yamlContent);
                console.log("Parsed parameters count:", parameters.length);

                if (parameters.length > 0) {
                  vscode.window.showInformationMessage(
                    `Found ${parameters.length} parameter(s) for this pipeline`
                  );
                  
                  // Prompt user for parameter values
                  const paramValues = await collectParameterValues(parameters);

                  if (paramValues === null) {
                    // User cancelled parameter input
                    vscode.window.showInformationMessage("Pipeline run cancelled");
                    return;
                  }

                  templateParameters = paramValues;
                  console.log("Collected parameter values:", templateParameters);
                } else {
                  // No parameters found - this is fine, proceed without parameters
                  console.log("No parameters found in YAML file:", yamlPath);
                }
              } else {
                console.log("Failed to fetch YAML content for:", yamlPath);
                vscode.window.showWarningMessage(
                  `Could not fetch YAML file: ${yamlPath}. Check Developer Console for details.`
                );
              }
            } else {
              console.log("Missing YAML path or repository ID");
              console.log("YAML path:", yamlPath, "Repo ID:", repoId);
              vscode.window.showWarningMessage(
                "Pipeline configuration incomplete. Check Developer Console for details."
              );
            }
          } else {
            console.log("No pipeline configuration found");
            console.log("Pipeline definition:", JSON.stringify(pipelineDefinition, null, 2));
            vscode.window.showWarningMessage(
              "Pipeline definition has no configuration. Check Developer Console for details."
            );
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
                selectedBranch,
                templateParameters
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

  // Toggle Polling Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "azurePipelinesRunner.togglePolling",
      async () => {
        const config = vscode.workspace.getConfiguration("azurePipelinesRunner");
        const currentValue = config.get<boolean>("enablePolling", true);
        await config.update("enablePolling", !currentValue, vscode.ConfigurationTarget.Global);
        
        const status = !currentValue ? "enabled" : "disabled";
        vscode.window.showInformationMessage(`Azure Pipelines polling ${status}`);
      }
    )
  );
}
