export type ApprovalDecision = "approve" | "reject";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "skipped" | "canceled" | "timedOut" | "failed" | "completed";

export interface ApprovalStep {
  id: string;
  actualApprover?: {
    displayName: string;
    id: string;
    uniqueName: string;
  };
  assignedApprover?: {
    displayName: string;
    id: string;
    uniqueName: string;
  };
  comment?: string;
  initiatedOn?: string;
  modifiedOn?: string;
  status: ApprovalStatus;
}

export interface PendingApproval {
  id: string;
  steps: ApprovalStep[];
  status: ApprovalStatus;
  createdOn: string;
  lastModifiedOn: string;
  executionOrder: number;
  minRequiredApprovers: number;
  blockedApprovers?: unknown[];
  instructions?: string;
  _links?: {
    self: {
      href: string;
    };
    web?: {
      href: string;
    };
  };
}

export interface PendingApprovalsResponse {
  count: number;
  value: PendingApproval[];
}

export interface ApprovalRequest {
  status: ApprovalStatus;
  comment?: string;
  approvalId: string;
}

export interface ApprovalResponse {
  id: string;
  steps: ApprovalStep[];
  status: ApprovalStatus;
  createdOn: string;
  lastModifiedOn: string;
}
