import * as vscode from "vscode";
import { PipelineParameter, TemplateParameters } from "../types/types";

export async function collectParameterValues(
  parameters: PipelineParameter[]
): Promise<TemplateParameters | null> {
  const templateParameters: TemplateParameters = {};

  for (const param of parameters) {
    const displayName = param.displayName || param.name;
    const defaultValue = param.default;

    let value: string | undefined;

    if (param.values && param.values.length > 0) {
      // Parameter has predefined values - show quick pick
      const selectedValue = await vscode.window.showQuickPick(param.values, {
        placeHolder: `Select a value for parameter: ${displayName}`,
        title: `Pipeline Parameter: ${displayName}`,
        ignoreFocusOut: true,
      });

      if (selectedValue === undefined) {
        // User cancelled
        return null;
      }

      value = selectedValue;
    } else {
      // Parameter is free text - show input box
      const placeholder = defaultValue
        ? `Default: ${defaultValue}`
        : "Enter a value";

      const inputValue = await vscode.window.showInputBox({
        prompt: `Enter a value for parameter: ${displayName}`,
        placeHolder: placeholder,
        value: defaultValue,
        ignoreFocusOut: true,
        validateInput: (text) => {
          // Only validate if no default is provided and input is empty
          if (!defaultValue && (!text || text.trim().length === 0)) {
            return `A value for the '${param.name}' parameter must be provided.`;
          }
          return null;
        },
      });

      if (inputValue === undefined) {
        // User cancelled
        return null;
      }

      value = inputValue || defaultValue;
    }

    if (value) {
      templateParameters[param.name] = value;
    }
  }

  return templateParameters;
}
