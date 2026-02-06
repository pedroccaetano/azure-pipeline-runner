import { getAxiosInstance } from "../utils/api";
import { PendingApprovalsResponse, ApprovalResponse } from "../types/approvals";

const AZURE_DEVOPS_RESOURCE_ID = "499b84ac-1321-427f-aa17-267ca6975798";

/**
 * Get pending approvals for a pipeline run
 * @param organization Azure DevOps organization name
 * @param project Project name or ID
 * @param pat Personal Access Token
 * @returns Array of pending approvals
 */
export async function getPendingApprovals(
  organization: string,
  project: string,
  pat: string
): Promise<PendingApprovalsResponse> {
  const axiosInstance = getAxiosInstance(pat);
  const url = `https://dev.azure.com/${organization}/${project}/_apis/pipelines/approvals?api-version=7.1-preview.1`;

  try {
    const response = await axiosInstance.get<PendingApprovalsResponse>(url, {
      headers: {
        "X-VSS-ResourceId": AZURE_DEVOPS_RESOURCE_ID,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch pending approvals: ${error}`);
  }
}

/**
 * Approve a stage
 * @param organization Azure DevOps organization name
 * @param project Project name or ID
 * @param approvalId ID of the approval
 * @param comment Optional comment for the approval
 * @param pat Personal Access Token
 * @returns Approval response
 */
export async function approveStage(
  organization: string,
  project: string,
  approvalId: string,
  comment: string,
  pat: string
): Promise<ApprovalResponse> {
  const axiosInstance = getAxiosInstance(pat);
  const url = `https://dev.azure.com/${organization}/${project}/_apis/pipelines/approvals?api-version=7.1-preview.1`;

  try {
    const response = await axiosInstance.patch<ApprovalResponse[]>(
      url,
      [
        {
          approvalId: approvalId,
          status: "approved",
          comment: comment || undefined,
        },
      ],
      {
        headers: {
          "X-VSS-ResourceId": AZURE_DEVOPS_RESOURCE_ID,
        },
      }
    );

    if (!response.data || response.data.length === 0) {
      throw new Error("No approval response received");
    }

    return response.data[0];
  } catch (error) {
    throw new Error(`Failed to approve stage: ${error}`);
  }
}

/**
 * Reject a stage
 * @param organization Azure DevOps organization name
 * @param project Project name or ID
 * @param approvalId ID of the approval
 * @param comment Optional comment for the rejection
 * @param pat Personal Access Token
 * @returns Approval response
 */
export async function rejectStage(
  organization: string,
  project: string,
  approvalId: string,
  comment: string,
  pat: string
): Promise<ApprovalResponse> {
  const axiosInstance = getAxiosInstance(pat);
  const url = `https://dev.azure.com/${organization}/${project}/_apis/pipelines/approvals?api-version=7.1-preview.1`;

  try {
    const response = await axiosInstance.patch<ApprovalResponse[]>(
      url,
      [
        {
          approvalId: approvalId,
          status: "rejected",
          comment: comment || undefined,
        },
      ],
      {
        headers: {
          "X-VSS-ResourceId": AZURE_DEVOPS_RESOURCE_ID,
        },
      }
    );

    if (!response.data || response.data.length === 0) {
      throw new Error("No approval response received");
    }

    return response.data[0];
  } catch (error) {
    throw new Error(`Failed to reject stage: ${error}`);
  }
}
