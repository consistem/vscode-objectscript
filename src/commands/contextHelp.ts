import axios from "axios";
import * as https from "https";
import * as path from "path";
import * as vscode from "vscode";

import { AtelierAPI } from "../api";
import { handleError } from "../utils";

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
  const { host, port, username, password, https: useHttps, pathPrefix } = api.config;

  if (!host || !port) {
    void vscode.window.showErrorMessage("No active InterSystems server connection for this file.");
    return;
  }

  const normalizedPrefix = pathPrefix ? (pathPrefix.startsWith("/") ? pathPrefix : `/${pathPrefix}`) : "";

  const baseUrl = `${useHttps ? "https" : "http"}://${host}:${port}${encodeURI(normalizedPrefix)}`;
  const url = `${baseUrl}/api/sourcecontrol/vscode/resolveContextExpression`;

  const httpsAgent = new https.Agent({
    rejectUnauthorized: vscode.workspace.getConfiguration("http").get("proxyStrictSSL"),
  });

  try {
    const response = await axios.post<ResolveContextExpressionResponse>(
      url,
      {
        routine,
        contextExpression,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        auth:
          typeof username === "string" && typeof password === "string"
            ? {
                username,
                password,
              }
            : undefined,
        httpsAgent,
      }
    );

    const data = response.data ?? {};
    if (typeof data.status === "string" && data.status.toLowerCase() === "success" && data.textExpression) {
      const eol = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
      const textExpression = data.textExpression.replace(/\r?\n/g, eol);
      const formattedTextExpression = textExpression.replace(/^/, "\t");
      const lineRange = document.lineAt(selection.active.line).range;
      await editor.edit((editBuilder) => {
        editBuilder.replace(lineRange, formattedTextExpression);
      });
    } else {
      const errorMessage = data.message || "Failed to resolve context expression.";
      void vscode.window.showErrorMessage(errorMessage);
    }
  } catch (error) {
    handleError(error, "Failed to resolve context expression.");
  }
}