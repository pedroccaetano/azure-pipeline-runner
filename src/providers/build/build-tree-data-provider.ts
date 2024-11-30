import * as vscode from 'vscode';
import { getBuildsByDefinitionId, getCommitMessage } from  '../../utils/requests';
import { Build } from '../../types/builds';
import { Pipeline, Project } from '../../types/types';
import { BuildItem } from './build-item';

export class BuildTreeDataProvider implements vscode.TreeDataProvider<BuildItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BuildItem | undefined | void> = new vscode.EventEmitter<BuildItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<BuildItem | undefined | void> = this._onDidChangeTreeData.event;

    private builds: BuildItem[] = [];
    private allBuilds: Build[] = [];

    constructor() {
    }

    refresh(): void {
        this.builds = [];
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BuildItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: BuildItem): Promise<BuildItem[]> {
        if (!element) {
            return this.builds;
        }

        return [];
    }

 
    async loadBuilds(pipeline: Pipeline, project: Project): Promise<void> {
        await this.showProgress(`Loading builds for ${pipeline.name}`, async (progress) => {
            const builds = await getBuildsByDefinitionId(project.name, pipeline.id);

            if (builds.length === 0) {
                vscode.window.showWarningMessage('No builds found!');
                return;
            }

            this.allBuilds = builds;
            const firstBuilds = builds.slice(0, 5);

            await this.appendCommitMessages(firstBuilds, project.name);

            this.builds = this.createBuildItems(firstBuilds, project, pipeline);
            this._onDidChangeTreeData.fire();
            progress.report({ increment: 100 });
        });
    }

    async refreshBuilds(): Promise<void> {
        if (this.builds.length === 0) return;

        const projectName = this.builds[0].project?.name as string;
        const pipelineId = this.builds[0].pipeline?.id as number;

        await this.loadBuilds({ id: pipelineId, name: this.builds[0].pipeline?.name } as Pipeline, { name: projectName } as Project);
    }

    async loadMoreBuilds(): Promise<void> {
        await this.showProgress(`Loading more builds for ${this.builds[0].pipeline?.name}`, async (progress) => {
            const nextBuilds = this.allBuilds.slice(this.builds.length, this.builds.length + 5);
            const projectName = this.builds[0].project?.name;

            await this.appendCommitMessages(nextBuilds, projectName as string);

            const buildItems = this.createBuildItems(nextBuilds, this.builds[0].project as Project, this.builds[0].pipeline as Pipeline);
            this.builds = [...this.builds, ...buildItems];
            this._onDidChangeTreeData.fire();
            progress.report({ increment: 100 });
        });
    }

    private async appendCommitMessages(builds: Build[], projectName: string): Promise<void> {
        for (const build of builds) {
            if (build.appendCommitMessageToRunName) {
                const commitMessage = await getCommitMessage(projectName, build.repository.id, build.sourceVersion);
                build.commitMessage = commitMessage;
            }
        }
    }

    private createBuildItems(builds: Build[], project: Project, pipeline: Pipeline): BuildItem[] {
        return builds.map(build => new BuildItem(
            `#${build.buildNumber} • ${build.commitMessage?.split('\n')[0]}`,
            vscode.TreeItemCollapsibleState.None,
            'build',
            [build],
            project,
            pipeline
        ));
    }

    private async showProgress(title: string, task: (progress: vscode.Progress<{ increment: number }>) => Promise<void>): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title,
            cancellable: false
        }, task);
    }
}