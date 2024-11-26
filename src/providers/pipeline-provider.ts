import * as vscode from 'vscode';
import { Build, PipelineById } from '../types/builds';
import { PipelinesResponse, Pipeline, Project, ProjectsResponse, BuildTimeline } from '../types/types';
import { getAxiosInstance } from '../utils/axiosInstance';

const top : number = 5;

export async function getProjects(): Promise<Project[]> {
    const pat =  await vscode.workspace.getConfiguration().get('azurePipelineRunner.pat') as string;
    const organization =  await vscode.workspace.getConfiguration().get('azurePipelineRunner.organization')
    const url = `https://dev.azure.com/${organization}/_apis/projects?api-version=7.1`;
    try {
        const response = await getAxiosInstance(pat).get<ProjectsResponse>(url);
        return response.data.value;
    } catch (error) {
        console.error('Error listing projects:', error);
        return [];
    }
}

export async function getPipelines(project: string): Promise<Pipeline[]> {
    const pat =  await vscode.workspace.getConfiguration().get('azurePipelineRunner.pat') as string;
    const organization =  await vscode.workspace.getConfiguration().get('azurePipelineRunner.organization')
    const url = `https://dev.azure.com/${organization}/${project}/_apis/pipelines?api-version=7.1`;

    try {
        const response = await getAxiosInstance(pat).get<PipelinesResponse>(url);
        return response.data.value;
    } catch (error) {
        console.error('Error listing pipelines:', error);
        return [];
    }
}

export async function getBuildsByDefinitionId(project: string, definitionId: number, top: number = 5, skip: number = 0): Promise<Build[]> {
    const pat =  await vscode.workspace.getConfiguration().get('azurePipelineRunner.pat') as string;
    const organization =  await vscode.workspace.getConfiguration().get('azurePipelineRunner.organization')
    const url = `https://dev.azure.com/${organization}/${project}/_apis/build/builds?definitions=${definitionId}&$top=${top}&$skip=${skip}&statusFilter=cancelled,completed,inProgress,none,notStarted,postponed&api-version=7.1`;

    try {
        const response = await getAxiosInstance(pat).get<PipelineById>(url);
        const builds = response.data.value;

        for (const build of builds) {
            if (build.appendCommitMessageToRunName) {
                const commitMessage = await getCommitMessage(project, build.repository.id, build.sourceVersion);
                build.commitMessage = commitMessage;
            }
        }

        return builds;
    } catch (error) {
        console.error('Error listing builds:', error);
        return [];
    }
}


async function getCommitMessage(project: string, repositoryId: string, commitId: string): Promise<string> {
    const pat =  await vscode.workspace.getConfiguration().get('azurePipelineRunner.pat') as string;
    const organization =  await vscode.workspace.getConfiguration().get('azurePipelineRunner.organization')
    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/commits/${commitId}?api-version=7.1`;
    try {
        const response = await getAxiosInstance(pat).get(url);
        return response.data.comment;
    } catch (error) {
        console.error('Error getting commit message:', error);
        return '';
    }
}
export async function getBuildStages(project: string, buildId: number): Promise<BuildTimeline> {
    const pat =  await vscode.workspace.getConfiguration().get('azurePipelineRunner.pat') as string;
    const organization =  await vscode.workspace.getConfiguration().get('azurePipelineRunner.organization')
   const url = `https://dev.azure.com/${organization}/${project}/_apis/build/builds/${buildId}/timeline?api-version=7.1`;
    try {
        const response = await getAxiosInstance(pat).get<BuildTimeline>(url);
        return response.data;
    } catch (error) {
        console.error('Error getting build stages:', error);
        throw error;
    }
}