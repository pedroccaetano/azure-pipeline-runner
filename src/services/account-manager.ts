import * as vscode from "vscode";
import { AccountData, UserInfo, ConnectionDataResponse } from "../types/account";
import { getAxiosInstance } from "../utils/api";

const STORAGE_KEY = "azurePipelinesRunner.accounts";
const ACTIVE_ACCOUNT_KEY = "azurePipelinesRunner.activeAccountId";

/**
 * Manages Azure DevOps accounts with secure credential storage
 */
export class AccountManager {
  private static instance: AccountManager | null = null;
  private context: vscode.ExtensionContext;
  private _onDidChangeAccounts = new vscode.EventEmitter<void>();
  readonly onDidChangeAccounts = this._onDidChangeAccounts.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Initialize the singleton instance
   */
  static initialize(context: vscode.ExtensionContext): AccountManager {
    if (!AccountManager.instance) {
      AccountManager.instance = new AccountManager(context);
    }
    return AccountManager.instance;
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): AccountManager {
    if (!AccountManager.instance) {
      throw new Error("AccountManager not initialized. Call initialize() first.");
    }
    return AccountManager.instance;
  }

  /**
   * Generate a unique ID for an account
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Validate credentials and fetch user info from Azure DevOps
   */
  async validateAndFetchAccountInfo(organization: string, pat: string): Promise<UserInfo> {
    try {
      const url = `https://vssps.dev.azure.com/${organization}/_apis/connectionData?api-version=7.1-preview`;
      const response = await getAxiosInstance(pat).get<ConnectionDataResponse>(url);

      const displayName = response.data.authenticatedUser.providerDisplayName;
      const username = response.data.authenticatedUser.properties.Account.$value;

      return { username, displayName };
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number }; message?: string };
      if (axiosError.response?.status === 401) {
        throw new Error("Invalid Personal Access Token. Please check your credentials.");
      }
      if (axiosError.response?.status === 404) {
        throw new Error("Organization not found. Please check the organization name.");
      }
      if (axiosError.message) {
        throw new Error(`Failed to validate credentials: ${axiosError.message}`);
      }
      throw new Error("Failed to validate credentials. Please check your organization and PAT.");
    }
  }

  /**
   * Get all stored accounts
   */
  async getAccounts(): Promise<AccountData[]> {
    const data = await this.context.secrets.get(STORAGE_KEY);
    if (!data) {
      return [];
    }

    try {
      return JSON.parse(data) as AccountData[];
    } catch {
      return [];
    }
  }

  /**
   * Save accounts to secret storage
   */
  private async saveAccounts(accounts: AccountData[]): Promise<void> {
    await this.context.secrets.store(STORAGE_KEY, JSON.stringify(accounts));
    this._onDidChangeAccounts.fire();
  }

  /**
   * Add a new account
   */
  async addAccount(organization: string, pat: string, note: string): Promise<AccountData> {
    // Validate credentials first
    const userInfo = await this.validateAndFetchAccountInfo(organization, pat);

    const accounts = await this.getAccounts();

    const newAccount: AccountData = {
      id: this.generateId(),
      organization,
      pat,
      note,
      username: userInfo.username,
      displayName: userInfo.displayName,
      isActive: accounts.length === 0, // First account is automatically active
      createdAt: new Date().toISOString(),
    };

    accounts.push(newAccount);
    await this.saveAccounts(accounts);

    // If first account, set as active
    if (newAccount.isActive) {
      await this.context.globalState.update(ACTIVE_ACCOUNT_KEY, newAccount.id);
    }

    return newAccount;
  }

  /**
   * Delete an account by ID
   */
  async deleteAccount(accountId: string): Promise<void> {
    const accounts = await this.getAccounts();
    const index = accounts.findIndex((a) => a.id === accountId);

    if (index === -1) {
      throw new Error("Account not found.");
    }

    const wasActive = accounts[index].isActive;
    accounts.splice(index, 1);

    // If deleted account was active, clear the active account
    if (wasActive) {
      await this.context.globalState.update(ACTIVE_ACCOUNT_KEY, undefined);
      // Optionally set another account as active
      if (accounts.length > 0) {
        accounts[0].isActive = true;
        await this.context.globalState.update(ACTIVE_ACCOUNT_KEY, accounts[0].id);
      }
    }

    await this.saveAccounts(accounts);
  }

  /**
   * Update an account
   */
  async updateAccount(accountId: string, updates: Partial<Omit<AccountData, "id" | "createdAt">>): Promise<void> {
    const accounts = await this.getAccounts();
    const index = accounts.findIndex((a) => a.id === accountId);

    if (index === -1) {
      throw new Error("Account not found.");
    }

    accounts[index] = {
      ...accounts[index],
      ...updates,
    };

    await this.saveAccounts(accounts);
  }

  /**
   * Get the currently active account
   */
  async getActiveAccount(): Promise<AccountData | null> {
    const activeId = this.context.globalState.get<string>(ACTIVE_ACCOUNT_KEY);
    const accounts = await this.getAccounts();

    if (activeId) {
      const account = accounts.find((a) => a.id === activeId);
      if (account) {
        return account;
      }
    }

    // Fallback to the first account marked as active
    const activeAccount = accounts.find((a) => a.isActive);
    if (activeAccount) {
      return activeAccount;
    }

    // If no active account, return the first one
    return accounts.length > 0 ? accounts[0] : null;
  }

  /**
   * Set an account as active
   */
  async setActiveAccount(accountId: string): Promise<void> {
    const accounts = await this.getAccounts();
    const targetAccount = accounts.find((a) => a.id === accountId);

    if (!targetAccount) {
      throw new Error("Account not found.");
    }

    // Update isActive flag for all accounts
    for (const account of accounts) {
      account.isActive = account.id === accountId;
    }

    await this.context.globalState.update(ACTIVE_ACCOUNT_KEY, accountId);
    await this.saveAccounts(accounts);
  }

  /**
   * Remove legacy credentials from settings.json
   */
  private async removeLegacySettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration();

    // Remove from global settings.json
    await config.update("azurePipelinesRunner.organization", undefined, vscode.ConfigurationTarget.Global);
    await config.update("azurePipelinesRunner.pat", undefined, vscode.ConfigurationTarget.Global);

    // Also remove from workspace settings if a workspace is open
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      await config.update("azurePipelinesRunner.organization", undefined, vscode.ConfigurationTarget.Workspace);
      await config.update("azurePipelinesRunner.pat", undefined, vscode.ConfigurationTarget.Workspace);
    }
  }

  /**
   * Migrate credentials from legacy settings.json to secure storage
   */
  async migrateFromLegacySettings(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration();
    const organization = config.get<string>("azurePipelinesRunner.organization");
    const pat = config.get<string>("azurePipelinesRunner.pat");

    // Nothing to migrate if no legacy credentials
    if (!organization || !pat) {
      return false;
    }

    try {
      // Validate and add account
      const existingAccounts = await this.getAccounts();
      const account = await this.addAccount(organization, pat, "Migrated from settings.json");

      // Set as active if no other account is active
      const hasActiveAccount = existingAccounts.some((acc) => acc.isActive);
      if (!hasActiveAccount) {
        await this.setActiveAccount(account.id);
      }

      // Remove legacy settings from settings.json
      await this.removeLegacySettings();

      vscode.window.showInformationMessage(
        "Your Azure DevOps credentials have been migrated to secure storage and removed from settings.json"
      );

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      vscode.window.showErrorMessage(
        `Failed to migrate credentials: ${message}. Please add your account manually.`
      );
      return false;
    }
  }

  /**
   * Get sorted accounts (alphabetically by org, then note, then username)
   */
  async getSortedAccounts(): Promise<AccountData[]> {
    const accounts = await this.getAccounts();
    return accounts.sort((a, b) => {
      // Primary: Organization name
      const orgCompare = a.organization.localeCompare(b.organization);
      if (orgCompare !== 0) {
        return orgCompare;
      }

      // Secondary: Note (empty notes sorted last)
      const aNote = a.note || "\uffff"; // Use high unicode char for empty
      const bNote = b.note || "\uffff";
      const noteCompare = aNote.localeCompare(bNote);
      if (noteCompare !== 0) {
        return noteCompare;
      }

      // Tertiary: Username
      const usernameCompare = a.username.localeCompare(b.username);
      if (usernameCompare !== 0) {
        return usernameCompare;
      }

      // Quaternary: Created date
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }
}
