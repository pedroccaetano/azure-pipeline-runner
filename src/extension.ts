import * as vscode from 'vscode';
import { PipelineTreeDataProvider } from './providers/pipeline/pipeline-tree-data-provider';
import { registerCommands } from './commands/register-commands';
import { showWelcome } from './welcome';
import { BuildTreeDataProvider } from './providers/build/build-tree-data-provider';

export function activate(context: vscode.ExtensionContext) {
    const pipelineTreeDataProvider = new PipelineTreeDataProvider();
    const buildTreeDataProvider = new BuildTreeDataProvider();
    
    vscode.window.registerTreeDataProvider('azurePipelineView', pipelineTreeDataProvider);
    vscode.window.registerTreeDataProvider('azurePipelineBuilds', buildTreeDataProvider);

    registerCommands(context, pipelineTreeDataProvider, buildTreeDataProvider);


    const organization = vscode.workspace.getConfiguration().get('azurePipelineRunner.organization');
    const pat = vscode.workspace.getConfiguration().get('azurePipelineRunner.pat');
    if (!organization || !pat) {
        showWelcome();
    }
}

export function deactivate() {}