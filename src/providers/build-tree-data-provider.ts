import * as vscode from 'vscode';
import { getBuildsByDefinitionId, getCommitMessage } from  '../utils/requests';
import { Build } from '../types/builds';
import { Pipeline, Project } from '../types/types';
import path from 'path';

class BuildItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly builds?: Build[],
        public readonly project?: Project,
        public readonly pipeline?: Pipeline
    ) {
        super(label, collapsibleState);
        this.iconPath = this.getIconPath();
        this.tooltip = this.getTooltip();
    }

    private getIconPath(): { light: string; dark: string } {
        if (this.contextValue === 'build' && this.builds && this.builds.length > 0) {
            const build = this.builds[0];
            let iconName = '';
            switch (build.result) {
                case 'succeeded':
                    iconName = 'succeeded.svg';
                    break;
                case 'failed':
                    iconName = 'failed.svg';
                    break;
                case 'canceled':
                    iconName = 'canceled.svg';
                    break;
                case 'partiallySucceeded':
                    iconName = 'partiallySucceeded.svg';
                    break;
                default:
                    iconName = '';
                    break;
            }
            return {
                light: path.join(__filename, '..', '..', '..', 'resources', iconName),
                dark: path.join(__filename, '..', '..', '..', 'resources', iconName)
            };
        } else {
            return {
                light: path.join(__filename, '..', '..', '..', 'resources', 'repo.svg'),
                dark: path.join(__filename, '..', '..', '..', 'resources','repo.svg')
            };
        }
    }

    private getTooltip(): vscode.MarkdownString | string {
        if (this.contextValue === 'build' && this.builds && this.builds.length > 0) {
            const build = this.builds[0];
            const markdown = new vscode.MarkdownString();
            markdown.supportHtml = true;
            markdown.isTrusted = true;
            markdown.appendMarkdown(`### Build Details\n`);
            markdown.appendMarkdown(`---\n`);
            markdown.appendMarkdown(`**Build Number**: ${build.buildNumber}\n\n`);
            markdown.appendMarkdown(`**Status**: ${build.status}\n\n`);
            markdown.appendMarkdown(`**Result**: ${build.result}\n\n`);
            const startTime = new Date(build.startTime);
            const finishTime = new Date(build.finishTime);
            const totalTime = new Date(finishTime.getTime() - startTime.getTime());

            const formatDuration = (duration: Date) => {
                const hours = Math.floor(duration.getTime() / 3600000);
                const minutes = Math.floor((duration.getTime() % 3600000) / 60000);
                const seconds = ((duration.getTime() % 60000) / 1000).toFixed(0);
                let formattedDuration = '';
                if (hours > 0) {
                    formattedDuration += `${hours}h `;
                }
                if (minutes > 0 || hours > 0) {
                    formattedDuration += `${minutes}m `;
                }
                formattedDuration += `${seconds}s`;
                return formattedDuration.trim();
            };

            markdown.appendMarkdown(`**Durantion**: ${formatDuration(totalTime)}\n\n`);
            markdown.appendMarkdown(`---\n`);

            if (build.requestedFor) {
                const avatarUrl = build.requestedFor._links.avatar.href;
                markdown.appendMarkdown(`**Requested By**: <img src="${avatarUrl}" width="16" height="16" /> ${build.requestedFor.displayName}\n\n`);
            }

            return markdown;
        } else {
            return '';
        }
    }
}

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