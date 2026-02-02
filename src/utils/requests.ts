import * as vscode from "vscode";
import * as yaml from "js-yaml";
import { Build, PipelineById } from "../types/builds";
import {
  PipelinesResponse,
  Pipeline,
  Project,
  ProjectsResponse,
  PipelineDefinition,
  PipelineParameter,
  TemplateParameters,
} from "../types/types";
import { getAxiosInstance } from "./api";
import { BuildTimeline } from "../types/stages";
import { AccountManager } from "../services/account-manager";

export async function getConfiguration() {
  const accountManager = AccountManager.getInstance();
  const activeAccount = await accountManager.getActiveAccount();

  if (!activeAccount) {
    throw new Error("No active account. Please add an account first.");
  }

  return {
    pat: activeAccount.pat,
    organization: activeAccount.organization,
  };
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
  branch: string,
  templateParameters?: TemplateParameters
): Promise<Build | null> {
  try {
    const { pat, organization } = await getConfiguration();
    const url = `https://dev.azure.com/${organization}/${project}/_apis/pipelines/${pipelineId}/runs?api-version=7.1-preview.1`;
    const requestBody: any = {
      resources: {
        repositories: {
          self: {
            refName: `refs/heads/${branch}`,
          },
        },
      },
    };
    
    // Add template parameters if provided
    if (templateParameters && Object.keys(templateParameters).length > 0) {
      requestBody.templateParameters = templateParameters;
    }
    
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

export async function getPipelineRun(
  project: string,
  pipelineId: number,
  runId: number
): Promise<{ templateParameters?: { [key: string]: string }; resources?: { repositories?: { self?: { refName?: string } } } } | null> {
  try {
    const { pat, organization } = await getConfiguration();
    const url = `https://dev.azure.com/${organization}/${project}/_apis/pipelines/${pipelineId}/runs/${runId}?api-version=7.1-preview.1`;
    const response = await getAxiosInstance(pat).get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching pipeline run:", error);
    return null;
  }
}

export async function getPipelineDefinition(
  project: string,
  pipelineId: number
): Promise<PipelineDefinition | null> {
  try {
    const { pat, organization } = await getConfiguration();
    const url = `https://dev.azure.com/${organization}/${project}/_apis/pipelines/${pipelineId}?api-version=7.1`;
    const response = await getAxiosInstance(pat).get<PipelineDefinition>(url);
    return response.data;
  } catch (error) {
    vscode.window.showErrorMessage(
      "Error fetching pipeline definition. Please check if your PAT has the correct permissions."
    );
    return null;
  }
}

export async function getPipelineYaml(
  project: string,
  repositoryId: string,
  yamlPath: string,
  branch: string = "main"
): Promise<string | null> {
  try {
    const { pat, organization } = await getConfiguration();
    // Remove leading slash if present
    const cleanPath = yamlPath.startsWith("/") ? yamlPath.substring(1) : yamlPath;
    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/items?path=${encodeURIComponent(cleanPath)}&versionDescriptor.versionType=branch&versionDescriptor.version=${encodeURIComponent(branch)}&includeContent=true&api-version=7.1`;
    
    console.log("Fetching YAML from URL:", url);
    
    const response = await getAxiosInstance(pat).get(url);
    
    console.log("YAML response status:", response.status);
    console.log("YAML response data type:", typeof response.data);
    
    // The response.data could be a string or an object
    // If it's already a string, return it
    if (typeof response.data === 'string') {
      console.log("Got string response, length:", response.data.length);
      return response.data;
    }
    
    // If it's an object, try to extract the content
    if (response.data && typeof response.data === 'object') {
      if ('content' in response.data && typeof response.data.content === 'string') {
        console.log("Got content property, length:", response.data.content.length);
        return response.data.content;
      }
      // If it's an object without content, log and show error
      console.log("Response object keys:", Object.keys(response.data));
      console.log("Unexpected YAML response format:", JSON.stringify(response.data).substring(0, 500));
      vscode.window.showErrorMessage(
        `Unexpected YAML response format. Response has keys: ${Object.keys(response.data).join(', ')}`
      );
      return null;
    }
    
    return null;
  } catch (error: any) {
    console.error("Error fetching YAML file:", error);
    console.error("Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    
    let errorMsg = "Unknown error";
    if (error.response?.status === 404) {
      errorMsg = `YAML file not found: ${yamlPath}`;
    } else if (error.response?.data?.message) {
      errorMsg = error.response.data.message;
    } else if (error.message) {
      errorMsg = error.message;
    }
    
    vscode.window.showErrorMessage(
      `Failed to fetch YAML file: ${errorMsg}`
    );
    
    return null;
  }
}

export function parseYamlParameters(yamlContent: string): PipelineParameter[] {
  const parameters: PipelineParameter[] = [];
  
  try {
    // Parse the YAML content
    const parsedYaml = yaml.load(yamlContent) as any;
    
    if (!parsedYaml || !parsedYaml.parameters) {
      console.log("No 'parameters' section found in YAML");
      return parameters;
    }
    
    // Parameters should be an array
    if (!Array.isArray(parsedYaml.parameters)) {
      console.log("Parameters section is not an array");
      return parameters;
    }
    
    // Extract parameters
    for (const param of parsedYaml.parameters) {
      if (!param.name) {
        console.log("Parameter missing 'name' field, skipping:", param);
        continue;
      }
      
      parameters.push({
        name: param.name,
        displayName: param.displayName || param.name,
        type: param.type || 'string',
        default: param.default,
        values: param.values,
      });
    }
    
    console.log("Parsed parameters:", parameters.map(p => ({ 
      name: p.name, 
      hasValues: !!p.values,
      valuesCount: p.values?.length 
    })));
  } catch (error) {
    console.error("Error parsing YAML parameters:", error);
  }
  
  console.log("Total parameters found:", parameters.length);
  return parameters;
}

export async function getBuildDetails(
  project: string,
  buildId: number
): Promise<Build> {
  const { pat, organization } = await getConfiguration();
  const url = `https://dev.azure.com/${organization}/${project}/_apis/build/builds/${buildId}?api-version=7.1`;
  const response = await getAxiosInstance(pat).get<Build>(url);
  return response.data;
}

export async function retryBuildFailedJobs(
  project: string,
  buildId: number
): Promise<void> {
  const { pat, organization } = await getConfiguration();
  const url = `https://dev.azure.com/${organization}/${project}/_apis/build/builds/${buildId}?retry=true&api-version=7.1`;
  await getAxiosInstance(pat).patch(url, {});
}

export async function retryStage(
  project: string,
  buildId: number,
  stageIdentifier: string,
  forceRetryAllJobs: boolean
): Promise<void> {
  const { pat, organization } = await getConfiguration();
  const url = `https://dev.azure.com/${organization}/${project}/_apis/build/builds/${buildId}/stages/${stageIdentifier}?api-version=7.1`;
  await getAxiosInstance(pat).patch(url, {
    state: "retry",
    forceRetryAllJobs: forceRetryAllJobs,
  });
}

