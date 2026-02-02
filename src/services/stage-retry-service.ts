import * as vscode from "vscode";
import { StageRetryDecision, StageRetryMethod, TimelineRecord } from "../types/stages";
import { getBuildDetails, retryBuildFailedJobs, retryStage } from "../utils/requests";

/**
 * Determines which retry method to use based on build and stage status
 */
async function determineRetryMethod(
  projectName: string,
  buildId: number,
  stageId: string,
  stageIdentifier: string,
  allRecords: TimelineRecord[]
): Promise<StageRetryDecision> {
  // Get build information
  const build = await getBuildDetails(projectName, buildId);
  
  // Get stage information from the records
  const stage = allRecords.find(r => r.id === stageId);
  
  if (!stage) {
    throw new Error("Stage not found in timeline records");
  }
  
  // Check if stage has succeeded
  if (stage.result === "succeeded") {
    return {
      method: "stage-level-rerun",
      stageIdentifier,
      buildId,
      projectName,
    };
  }
  
  // Check if stage has failed checkpoint
  const hasFailedCheckpoint = allRecords.some(
    record => 
      record.type === "Checkpoint" && 
      record.parentId === stageId && 
      record.result === "failed"
  );
  
  if (hasFailedCheckpoint) {
    return {
      method: "stage-level-retry",
      stageIdentifier,
      buildId,
      projectName,
    };
  }
  
  // Default to build-level retry for failed stages without checkpoints
  return {
    method: "build-level-retry",
    buildId,
    projectName,
  };
}

/**
 * Main handler for stage retry operations
 */
export async function handleStageRetry(
  projectName: string,
  buildId: number,
  stageId: string,
  stageIdentifier: string,
  stageName: string,
  allRecords: TimelineRecord[]
): Promise<void> {
  try {
    // Determine which retry method to use
    const decision = await determineRetryMethod(
      projectName,
      buildId,
      stageId,
      stageIdentifier,
      allRecords
    );
    
    // Execute the appropriate retry method
    switch (decision.method) {
      case "stage-level-rerun": {
        // Succeeded stage - prompt user for options
        const options = [
          {
            label: "$(play) Rerun just this stage",
            description: "Only retry failed jobs in this stage",
            value: false,
          },
          {
            label: "$(run-all) Rerun stage and its dependents",
            description: "Retry all jobs and trigger dependent stages",
            value: true,
          },
        ];
        
        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: "Choose how to rerun this stage",
        });
        
        if (!selected) {
          return; // User cancelled
        }
        
        await retryStage(
          projectName,
          buildId,
          stageIdentifier,
          selected.value
        );
        
        vscode.window.showInformationMessage(
          `Rerunning stage '${stageName}'`
        );
        break;
      }
      
      case "stage-level-retry": {
        // Failed checkpoint - retry stage
        await retryStage(
          projectName,
          buildId,
          stageIdentifier,
          false
        );
        
        vscode.window.showInformationMessage(
          `Retrying stage '${stageName}'`
        );
        break;
      }
      
      case "build-level-retry": {
        // Failed stage without checkpoint - retry build
        await retryBuildFailedJobs(projectName, buildId);
        
        vscode.window.showInformationMessage(
          `Retrying failed jobs in build #${buildId}`
        );
        break;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(
      `Failed to retry stage: ${errorMessage}`
    );
    throw error;
  }
}
