import * as vscode from "vscode";
import { PipelineParameter, TemplateParameters } from "../types/types";

export async function collectParameterValues(
  parameters: PipelineParameter[]
): Promise<TemplateParameters | null> {
  const templateParameters: TemplateParameters = {};

  for (const param of parameters) {
    const displayName = param.displayName || param.name;
    // Convert default value to string to handle booleans (false) and other types correctly
    const hasDefault = param.default !== undefined && param.default !== null;
    const defaultValue = hasDefault ? String(param.default) : undefined;

    let value: string | undefined;

    if (param.values && param.values.length > 0) {
      // Parameter has predefined values - show quick pick
      // Create quick pick items with the default value marked
      const quickPickItems = param.values.map((val) => ({
        label: val,
        description: val === defaultValue ? "(default)" : undefined,
        picked: val === defaultValue,
      }));

      const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: hasDefault
          ? `Select a value for parameter: ${displayName} (default: ${defaultValue})`
          : `Select a value for parameter: ${displayName}`,
        title: `Pipeline Parameter: ${displayName}`,
        ignoreFocusOut: true,
      });

      if (selectedItem === undefined) {
        // User cancelled
        return null;
      }

      value = selectedItem.label;
    } else {
      // Parameter is free text - show input box
      const placeholder = hasDefault
        ? `Default: ${defaultValue}`
        : "Enter a value";

      const inputValue = await vscode.window.showInputBox({
        prompt: `Enter a value for parameter: ${displayName}`,
        placeHolder: placeholder,
        value: defaultValue,
        ignoreFocusOut: true,
        validateInput: (text) => {
          // Only validate if no default is provided and input is empty
          if (!hasDefault && (!text || text.trim().length === 0)) {
            return `A value for the '${param.name}' parameter must be provided.`;
          }
          return null;
        },
      });

      if (inputValue === undefined) {
        // User cancelled
        return null;
      }

      value = inputValue !== "" ? inputValue : defaultValue;
    }

    if (value !== undefined && value !== "") {
      templateParameters[param.name] = value;
    }
  }

  return templateParameters;
}
