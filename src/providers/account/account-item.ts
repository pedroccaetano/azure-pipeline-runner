import * as vscode from "vscode";
import { AccountData } from "../../types/account";

/**
 * Tree item representing an Azure DevOps account in the Accounts view
 */
export class AccountItem extends vscode.TreeItem {
  constructor(
    public readonly account: AccountData,
    public readonly isActive: boolean
  ) {
    super(account.organization, vscode.TreeItemCollapsibleState.None);

    this.contextValue = isActive ? "account-active" : "account";
    this.description = this.getDescription();
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();

    // Clicking on an account switches to it
    this.command = {
      command: "azurePipelinesRunner.switchAccount",
      title: "Switch Account",
      arguments: [account],
    };
  }

  /**
   * Get the description shown after the label
   * Format: "Note (username)" or just "(username)" if no note
   */
  private getDescription(): string {
    if (this.account.note) {
      return `${this.account.note} (${this.account.username})`;
    }
    return `(${this.account.username})`;
  }

  /**
   * Get the tooltip shown on hover
   */
  private getTooltip(): string {
    const parts = [
      `Organization: ${this.account.organization}`,
      `Username: ${this.account.username}`,
      `Display Name: ${this.account.displayName}`,
    ];

    if (this.account.note) {
      parts.push(`Note: ${this.account.note}`);
    }

    if (this.isActive) {
      parts.push("", "✓ Active Account");
    }

    return parts.join("\n");
  }

  /**
   * Get the icon based on active state
   */
  private getIcon(): vscode.ThemeIcon {
    if (this.isActive) {
      return new vscode.ThemeIcon("check");
    }
    return new vscode.ThemeIcon("account");
  }
}

/**
 * Tree item for the "Add Account" action
 */
export class AddAccountItem extends vscode.TreeItem {
  constructor() {
    super("Add Account", vscode.TreeItemCollapsibleState.None);

    this.contextValue = "addAccount";
    this.iconPath = new vscode.ThemeIcon("add");
    this.tooltip = "Add a new Azure DevOps account";

    this.command = {
      command: "azurePipelinesRunner.addAccount",
      title: "Add Account",
    };
  }
}
