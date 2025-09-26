import * as path from "path";
import * as vscode from "vscode";

import { AtelierAPI } from "../../api";
import { SourceControlApi } from "../../api/ccs/sourceControl";
import { handleError } from "../../utils";

interface ResolveContextExpressionResponse {
  status?: string;
  textExpression?: string;
  message?: string;
}

export async function resolveContextExpression(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const { document, selection } = editor;
  const contextExpression = selection.isEmpty
    ? document.lineAt(selection.active.line).text.trim()
    : document.getText(selection).trim();

  if (!contextExpression) {
    void vscode.window.showErrorMessage("Context expression is empty.");
    return;
  }

  const routine = path.basename(document.fileName);
  const api = new AtelierAPI(document.uri);

  let sourceControlApi: SourceControlApi;
  try {
    sourceControlApi = SourceControlApi.fromAtelierApi(api);
  } catch (error) {
    void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
    return;
  }

  try {
    const response = await sourceControlApi.post<ResolveContextExpressionResponse>("/resolveContextExpression", {
      routine,
      contextExpression,
    });

    const data = response.data ?? {};
    if (typeof data.status === "string" && data.status.toLowerCase() === "success" && data.textExpression) {
      const eol = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
      const textExpression = data.textExpression.replace(/\r?\n/g, eol);
      const formattedTextExpression = textExpression.replace(/^/, "\t");
      const rangeToReplace = selection.isEmpty
        ? document.lineAt(selection.active.line).range
        : new vscode.Range(selection.start, selection.end);
      await editor.edit((editBuilder) => {
        editBuilder.replace(rangeToReplace, formattedTextExpression);
      });
    } else {
      const errorMessage = data.message || "Failed to resolve context expression.";
      void vscode.window.showErrorMessage(errorMessage);
    }
  } catch (error) {
    handleError(error, "Failed to resolve context expression.");
  }
}