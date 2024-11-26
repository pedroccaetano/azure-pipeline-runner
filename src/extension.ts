import * as vscode from 'vscode';
import { PipelineTreeDataProvider } from './providers/pipeline-tree-data-provider';
import { registerCommands } from './commands/registerCommands';
import { showWelcome } from './welcome';

export function activate(context: vscode.ExtensionContext) {
    const treeDataProvider = new PipelineTreeDataProvider();
    vscode.window.registerTreeDataProvider('azurePipelineView', treeDataProvider);

    registerCommands(context, treeDataProvider);

    const organization = vscode.workspace.getConfiguration().get('azurePipelineRunner.organization');
    const pat = vscode.workspace.getConfiguration().get('azurePipelineRunner.pat');
    if (!organization || !pat) {
        showWelcome();
    }
}

export function deactivate() {}