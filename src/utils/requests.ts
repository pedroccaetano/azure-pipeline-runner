import * as vscode from "vscode";
import { Build, PipelineById } from "../types/builds";
import {
  PipelinesResponse,
  Pipeline,
  Project,
  ProjectsResponse,
} from "../types/types";
import { getAxiosInstance } from "./api";
import { BuildTimeline } from "../types/stages";

export async function getConfiguration() {
  const pat = (await vscode.workspace
    .getConfiguration()
    .get("azurePipelinesRunner.pat")) as string;
  const organization = (await vscode.workspace
    .getConfiguration()
    .get("azurePipelinesRunner.organization")) as string;

  return { pat, organization };
}

export async function getProjects(): Promise<Project[]> {
  try {
    const { pat, organization } = await getConfiguration();
    const url = `https://dev.azure.com/${organization}/_apis/projects?api-version=7.1`;
    const response = await getAxiosInstance(pat).get<ProjectsResponse>(url);
    return response.data.value;
  } catch (error) {
    vscode.window.showErrorMessage(
      "Error listing projects. Please check if your PAT has the correct permissions."
    );
    return [];
  }
}

export async function getPipelines(project: string): Promise<Pipeline[]> {
  try {
    const { pat, organization } = await getConfiguration();
    const url = `https://dev.azure.com/${organization}/${project}/_apis/pipelines?api-version=7.1`;
    const response = await getAxiosInstance(pat).get<PipelinesResponse>(url);

    if (response?.data?.value.length === 0) {
      vscode.window.showWarningMessage("No pipelines found!");
      return [];
    }

    return response.data.value;
  } catch (error) {
    vscode.window.showErrorMessage(
      "Error listing pipelines. Check if your PAT has the correct permissions."
    );
    return [];
  }
}

export async function getBuildsByDefinitionId(
  project: string,
  definitionId: number
): Promise<Build[]> {
  try {
    const { pat, organization } = await getConfiguration();
    const url = `https://dev.azure.com/${organization}/${project}/_apis/build/builds?definitions=${definitionId}&statusFilter=cancelled,completed,inProgress,none,notStarted,postponed&api-version=7.1`;
    const response = await getAxiosInstance(pat).get<PipelineById>(url);
    const builds = response.data.value;

    return builds;
  } catch (error) {
    vscode.window.showErrorMessage(
      "Error listing builds. Please check if your PAT has the correct permissions."
    );
    return [];
  }
}

export async function getCommitMessage(
  project: string,
  repositoryId: string,
  commitId: string
): Promise<string> {
  try {
    const { pat, organization } = await getConfiguration();
    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/commits/${commitId}?api-version=7.1`;
    const response = await getAxiosInstance(pat).get(url);
    return response.data.comment;
  } catch (error) {
    vscode.window.showErrorMessage(
      "Error getting commit message. Please check if your PAT has the correct permissions."
    );
    return "";
  }
}

export async function getBuildStages(
  project: string,
  buildId: number
): Promise<BuildTimeline> {
  try {
    const { pat, organization } = await getConfiguration();
    const url = `https://dev.azure.com/${organization}/${project}/_apis/build/builds/${buildId}/timeline?api-version=7.1`;
    const response = await getAxiosInstance(pat).get<BuildTimeline>(url);
    return response.data;
  } catch (error) {
    vscode.window.showErrorMessage(
      "Error getting build stages. Please check if your PAT has the correct permissions."
    );
    return {} as BuildTimeline;
  }
}

export async function getStageLog(
  url: string
): Promise<{ count: number; value: string[] }> {
  const { pat } = await getConfiguration();

  const response = await getAxiosInstance(pat).get(url);

  return response.data;
}

export async function getRemoteBranches(
  project: string,
  repositoryId: string
): Promise<string[]> {
  try {
    const { pat, organization } = await getConfiguration();
    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/refs?filter=heads/&api-version=7.1`;
    const response = await getAxiosInstance(pat).get(url);
    const branches = response.data.value.map((ref: any) =>
      ref.name.replace("refs/heads/", "")
    );
    return branches;
  } catch (error) {
    vscode.window.showErrorMessage(
      "Error fetching branches. Please check if your PAT has the correct permissions."
    );
    return [];
  }
}

export async function runPipeline(
  project: string,
  pipelineId: number,
  branch: string
): Promise<Build | null> {
  try {
    const { pat, organization } = await getConfiguration();
    const url = `https://dev.azure.com/${organization}/${project}/_apis/pipelines/${pipelineId}/runs?api-version=7.1-preview.1`;
    const requestBody = {
      resources: {
        repositories: {
          self: {
            refName: `refs/heads/${branch}`,
          },
        },
      },
    };
    const response = await getAxiosInstance(pat).post(url, requestBody);
    return response.data;
  } catch (error: any) {
    let errorMessage = "Unknown error";
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.data) {
      errorMessage = JSON.stringify(error.response.data);
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    vscode.window.showErrorMessage(
      `Failed to run pipeline: ${errorMessage}`
    );
    return null;
  }
}
