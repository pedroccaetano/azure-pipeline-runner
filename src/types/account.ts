/**
 * Account-related type definitions for Azure Pipelines Runner
 */

/**
 * Represents a stored Azure DevOps account
 */
export interface AccountData {
  /** Unique identifier for the account (UUID) */
  id: string;
  /** Azure DevOps organization name */
  organization: string;
  /** Personal Access Token (stored encrypted) */
  pat: string;
  /** User-defined identifier/note for the account */
  note: string;
  /** Username fetched from Azure DevOps API */
  username: string;
  /** Display name fetched from Azure DevOps API */
  displayName: string;
  /** Whether this is the currently active account */
  isActive: boolean;
  /** ISO timestamp of when the account was created */
  createdAt: string;
}

/**
 * User information fetched from Azure DevOps API
 */
export interface UserInfo {
  /** Username from Azure DevOps */
  username: string;
  /** Display name from Azure DevOps */
  displayName: string;
}

/**
 * Response from Azure DevOps connection data API
 */
export interface ConnectionDataResponse {
  authenticatedUser: {
    providerDisplayName: string;
    properties: {
      Account: {
        $value: string;
      };
    };
  };
}
