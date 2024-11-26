import * as vscode from 'vscode';
import { Pipeline, Project } from '../types/types';
import { PipelineTreeDataProvider } from '../providers/pipeline-tree-data-provider';
import { Build } from '../types/builds';

const openExternalLink = (url: string) => {
    if (!url) {
        return vscode.window.showErrorMessage('Link is not available.');
    } 
    vscode.env.openExternal(vscode.Uri.parse(url));
}

export function registerCommands(context: vscode.ExtensionContext, treeDataProvider: PipelineTreeDataProvider) {
    context.subscriptions.push(
        vscode.commands.registerCommand('azurePipelineRunner.refreshEntry', () => treeDataProvider.refresh())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('azurePipelineRunner.openPipeline', ({pipeline}: {pipeline: Pipeline}) => {
            openExternalLink(pipeline._links.web.href);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('azurePipelineRunner.openBuild', ({builds}: {builds: Build[]}) => {
            const build = builds[0];
            openExternalLink(build._links.web.href);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('azurePipelineRunner.showWelcome', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'azurePipelineRunner');
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('azurePipelineRunner.refreshPipeline',  ({pipeline, project}: {pipeline: Pipeline, project: Project}) => {
            vscode.window.showWarningMessage('Not implemented yet!');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('azurePipelineRunner.loadMoreBuilds', async ({pipeline, project}: {pipeline: Pipeline, project: Project}) => {
           vscode.window.showWarningMessage('Not implemented yet!');
        })
    );
}