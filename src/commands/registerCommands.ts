import * as vscode from 'vscode';
import { Pipeline, Project } from '../types/types';
import { PipelineTreeDataProvider } from '../providers/pipeline-tree-data-provider';
import { Build } from '../types/builds';
import { BuildTreeDataProvider } from '../providers/build-tree-data-provider';

const openExternalLink = (url: string) => {
    if (!url) {
        return vscode.window.showErrorMessage('Link is not available.');
    } 
    vscode.env.openExternal(vscode.Uri.parse(url));
}
export function registerCommands(context: vscode.ExtensionContext, pipelineTreeDataProvider: PipelineTreeDataProvider, buildTreeDataProvider: BuildTreeDataProvider) {
    context.subscriptions.push(
        vscode.commands.registerCommand('azurePipelineRunner.refreshEntry', () => pipelineTreeDataProvider.refresh())
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
        vscode.commands.registerCommand('azurePipelineRunner.refreshBuilds',  async () => {
            await buildTreeDataProvider.refreshBuilds();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('azurePipelineRunner.loadMoreBuilds', async () => {
            await buildTreeDataProvider.loadMoreBuilds();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('azurePipelineRunner.loadBuilds', async ({pipeline, project}: {pipeline: Pipeline, project: Project}) => {
            await buildTreeDataProvider.loadBuilds(pipeline, project);
        })
    );
}