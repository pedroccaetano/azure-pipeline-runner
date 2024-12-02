import * as vscode from "vscode";

export async function showWelcome() {
  const organization = await vscode.window.showInputBox({
    prompt: "Enter your Azure DevOps organization name",
    placeHolder: "Organization name",
  });

  const pat = await vscode.window.showInputBox({
    prompt: "Enter your Personal Access Token (PAT)",
    placeHolder: "PAT",
    password: true,
  });

  if (organization && pat) {
    await vscode.workspace
      .getConfiguration()
      .update(
        "azurePipelinesRunner.organization",
        organization,
        vscode.ConfigurationTarget.Global
      );
    await vscode.workspace
      .getConfiguration()
      .update(
        "azurePipelinesRunner.pat",
        pat,
        vscode.ConfigurationTarget.Global
      );
    vscode.window.showInformationMessage("Settings saved successfully!");
  } else {
    vscode.window.showErrorMessage("Organization and PAT are required.");
  }
}
