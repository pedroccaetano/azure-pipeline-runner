import * as vscode from "vscode";

export async function showWelcome() {
  const selection = await vscode.window.showInformationMessage(
    "Welcome to Azure Pipelines Runner! To get started, add your Azure DevOps account using the Accounts pane.",
    "Add Account",
    "Learn More"
  );

  if (selection === "Add Account") {
    vscode.commands.executeCommand("azurePipelinesRunner.addAccount");
  } else if (selection === "Learn More") {
    vscode.env.openExternal(
      vscode.Uri.parse(
        "https://github.com/pedroccaetano/azure-pipeline-runner#readme"
      )
    );
  }
}
