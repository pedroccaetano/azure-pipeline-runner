import * as vscode from "vscode";

const MARKETPLACE_REVIEW_URL =
  "https://marketplace.visualstudio.com/items?itemName=PedroCaetano.azure-pipeline-runner&ssr=false#review-details";

const KEYS = {
  firstActivationDate: "azurePipelinesRunner.firstActivationDate",
  buildsTriggered: "azurePipelinesRunner.buildsTriggered",
  reviewState: "azurePipelinesRunner.reviewState",
} as const;

type ReviewState = "pending" | "dismissed" | "reviewed";

function shouldPrompt(context: vscode.ExtensionContext): boolean {
  if (context.globalState.get<ReviewState>(KEYS.reviewState, "pending") !== "pending") {
    return false;
  }
  const firstDate = context.globalState.get<string>(KEYS.firstActivationDate);
  if (!firstDate) {
    return false;
  }
  const daysSince = Math.floor((Date.now() - new Date(firstDate).getTime()) / 86400000);
  if (daysSince < 3) {
    return false;
  }
  return context.globalState.get<number>(KEYS.buildsTriggered, 0) >= 3;
}

export async function recordFirstActivation(context: vscode.ExtensionContext): Promise<void> {
  if (!context.globalState.get<string>(KEYS.firstActivationDate)) {
    await context.globalState.update(KEYS.firstActivationDate, new Date().toISOString());
  }
}

export async function recordBuildTriggered(context: vscode.ExtensionContext): Promise<void> {
  const current = context.globalState.get<number>(KEYS.buildsTriggered, 0);
  await context.globalState.update(KEYS.buildsTriggered, current + 1);
}

export async function checkAndPromptReview(context: vscode.ExtensionContext): Promise<void> {
  if (!shouldPrompt(context)) {
    return;
  }

  const LEAVE_REVIEW = "⭐ Leave a Review";
  const DONT_ASK = "Don't Ask Again";

  const selection = await vscode.window.showInformationMessage(
    "Enjoying Azure Pipeline Runner? Help us grow by leaving a review on the marketplace!",
    LEAVE_REVIEW,
    "Maybe Later",
    DONT_ASK,
  );

  if (selection === LEAVE_REVIEW) {
    await context.globalState.update(KEYS.reviewState, "reviewed");
    vscode.env.openExternal(vscode.Uri.parse(MARKETPLACE_REVIEW_URL));
  } else if (selection === DONT_ASK) {
    await context.globalState.update(KEYS.reviewState, "dismissed");
  }
  // "Maybe Later" or dismiss via X: no state change → re-prompts next time
}
