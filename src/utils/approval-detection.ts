import { TimelineRecord } from "../types/stages";

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
