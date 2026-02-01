import * as vscode from "vscode";
import { AccountManager } from "../../services/account-manager";
import { AccountItem } from "./account-item";

/**
 * Tree data provider for the Accounts view
 */
export class AccountTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private accountManager: AccountManager;

  constructor(accountManager: AccountManager) {
    this.accountManager = accountManager;

    // Listen for account changes and refresh the tree
    this.accountManager.onDidChangeAccounts(() => {
      this.refresh();
    });
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item for display
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of a tree item
   */
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    // Only show items at root level
    if (element) {
      return [];
    }

    const items: vscode.TreeItem[] = [];

    // Get sorted accounts and add them
    const accounts = await this.accountManager.getSortedAccounts();
    const activeAccount = await this.accountManager.getActiveAccount();

    for (const account of accounts) {
      const isActive = activeAccount?.id === account.id;
      items.push(new AccountItem(account, isActive));
    }

    return items;
  }
}
