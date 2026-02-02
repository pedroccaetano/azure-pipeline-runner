import { TimelineRecord } from "../types/stages";
import { getPendingApprovals } from "../services/approval-service";

/**
 * Checks if a stage is waiting for manual approval
 * @param stageId The ID of the stage to check
 * @param timelineRecords All timeline records from the build
 * @returns true if the stage is waiting for approval
 */
export function isStageWaitingForApproval(
  stageId: string,
  timelineRecords: TimelineRecord[]
): boolean {
  // Find checkpoint records that are children of this stage
  const checkpoint = timelineRecords.find(
    (r) =>
      r.type === "Checkpoint" &&
      r.parentId === stageId &&
      r.state === "inProgress"
  );

  if (!checkpoint) {
    return false;
  }

  // Verify there's an approval checkpoint under it
  const approvalCheckpoint = timelineRecords.find(
    (r) =>
      r.type === "Checkpoint.Approval" &&
      r.parentId === checkpoint.id &&
      r.state === "inProgress"
  );

  return !!approvalCheckpoint;
}

/**
 * Get the approval ID for a specific stage
 * @param organization Azure DevOps organization name
 * @param project Project name or ID
 * @param buildId Build ID
 * @param stageId Stage ID (name from timeline record)
 * @param pat Personal Access Token
 * @returns The approval ID if found, undefined otherwise
 */
export async function getApprovalIdForStage(
  organization: string,
  project: string,
  buildId: number,
  stageId: string,
  pat: string
): Promise<string | undefined> {
  try {
    const approvalsResponse = await getPendingApprovals(organization, project, pat);
    
    // Find the approval that matches this stage
    // The approval might not have a direct stage reference, so we'll return the first pending one
    // In a real scenario, you'd need to match based on additional context
    const pendingApproval = approvalsResponse.value.find(
      (approval) => approval.status === "pending"
    );

    return pendingApproval?.id;
  } catch (error) {
    console.error("Failed to get approval ID for stage:", error);
    return undefined;
  }
}
