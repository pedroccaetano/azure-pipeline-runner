import * as vscode from 'vscode';

export function openWalkthrough(): void {
  vscode.commands.executeCommand(
    'workbench.action.openWalkthrough',
    'PedroCaetano.azure-pipeline-runner#azurePipelinesRunner.gettingStarted',
    false
  );
}
