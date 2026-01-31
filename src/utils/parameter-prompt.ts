import * as vscode from "vscode";
import { PipelineParameter, TemplateParameters, TemplateParameterValue } from "../types/types";

/**
 * Format a value for display in the UI
 */
function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * Parse a string value back to its original type based on parameter type
 * For objects, returns the string as-is (YAML or JSON format)
 */
function parseValueByType(value: string, paramType?: string): TemplateParameterValue {
  if (paramType === 'boolean') {
    return value.toLowerCase() === 'true';
  }
  if (paramType === 'number') {
    const num = Number(value);
    return isNaN(num) ? value : num;
  }
  if (paramType === 'object' || paramType === 'stepList') {
    // Return as string (YAML or JSON format)
    return value;
  }
  return value;
}

/**
 * Check if parameter type supports multi-selection (arrays)
 */
function isArrayType(paramType?: string): boolean {
  return paramType === 'stringList' || paramType === 'stepList';
}

export async function collectParameterValues(
  parameters: PipelineParameter[]
): Promise<TemplateParameters | null> {
  const templateParameters: TemplateParameters = {};

  for (const param of parameters) {
    const displayName = param.displayName || param.name;
    const hasDefault = param.default !== undefined && param.default !== null;
    const defaultDisplayValue = hasDefault ? formatDisplayValue(param.default) : undefined;

    let resultValue: TemplateParameterValue | undefined;

    if (isArrayType(param.type) && param.values && param.values.length > 0) {
      // Multi-select for stringList with predefined values
      const defaultArray = Array.isArray(param.default) ? param.default.map(String) : [];
      
      const quickPickItems = param.values.map((val) => ({
        label: String(val),
        picked: defaultArray.includes(String(val)),
      }));

      const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: hasDefault
          ? `Select values for parameter: ${displayName} (default: ${defaultDisplayValue})`
          : `Select values for parameter: ${displayName}`,
        title: `Pipeline Parameter: ${displayName}`,
        ignoreFocusOut: true,
        canPickMany: true,
      });

      if (selectedItems === undefined) {
        return null;
      }

      // Convert array to YAML string format
      const yamlArray = selectedItems.map((item) => `- ${item.label}`).join('\n');
      resultValue = yamlArray;
    } else if (param.values && param.values.length > 0) {
      // Single-select with predefined values
      const quickPickItems = param.values.map((val) => {
        const valStr = String(val);
        return {
          label: valStr,
          description: valStr === defaultDisplayValue ? "(default)" : undefined,
          picked: valStr === defaultDisplayValue,
          originalValue: val,
        };
      });

      const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: hasDefault
          ? `Select a value for parameter: ${displayName} (default: ${defaultDisplayValue})`
          : `Select a value for parameter: ${displayName}`,
        title: `Pipeline Parameter: ${displayName}`,
        ignoreFocusOut: true,
      });

      if (selectedItem === undefined) {
        return null;
      }

      // Preserve original type for numbers
      resultValue = parseValueByType(selectedItem.label, param.type);
    } else if (param.type === 'boolean') {
      // Boolean type: show quick pick with true/false options
      const defaultBool = param.default === true || param.default === 'true' || param.default === 'True';
      const boolOptions = [
        {
          label: 'true',
          description: defaultBool ? '(default)' : undefined,
          picked: defaultBool,
        },
        {
          label: 'false',
          description: !defaultBool && hasDefault ? '(default)' : undefined,
          picked: !defaultBool && hasDefault,
        },
      ];

      const selectedBool = await vscode.window.showQuickPick(boolOptions, {
        placeHolder: hasDefault
          ? `Select value for parameter: ${displayName} (default: ${defaultDisplayValue})`
          : `Select value for parameter: ${displayName}`,
        title: `Pipeline Parameter: ${displayName}`,
        ignoreFocusOut: true,
      });

      if (selectedBool === undefined) {
        return null;
      }

      resultValue = selectedBool.label === 'true';
    } else {
      // Free text input for string, number, object, stepList
      const placeholder = hasDefault
        ? `Default: ${defaultDisplayValue}`
        : "Enter a value";

      const inputValue = await vscode.window.showInputBox({
        prompt: `Enter a value for parameter: ${displayName}`,
        placeHolder: placeholder,
        value: defaultDisplayValue,
        ignoreFocusOut: true,
        validateInput: (text) => {
          if (!hasDefault && (!text || text.trim().length === 0)) {
            return `A value for the '${param.name}' parameter must be provided.`;
          }
          // Validate JSON for object types
          if ((param.type === 'object' || param.type === 'stepList') && text && text.trim().length > 0) {
            try {
              JSON.parse(text);
            } catch {
              return 'Please enter valid JSON';
            }
          }
          return null;
        },
      });

      if (inputValue === undefined) {
        return null;
      }

      const finalValue = inputValue !== '' ? inputValue : defaultDisplayValue;
      if (finalValue !== undefined && finalValue !== '') {
        resultValue = parseValueByType(finalValue, param.type);
      }
    }

    if (resultValue !== undefined) {
      templateParameters[param.name] = resultValue;
    }
  }

  return templateParameters;
}
