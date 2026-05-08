import * as vscode from "vscode";

import { lookupCcsDefinition } from "../features/definitionLookup/lookup";

export async function goToDefinitionLocalFirst(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const { document, selection } = editor;
  const position = selection.active;
  const tokenSource = new vscode.CancellationTokenSource();

  try {
    const location = await lookupCcsDefinition(document, position, tokenSource.token);
    if (location) {
      try {
        await vscode.window.showTextDocument(location.uri, { selection: location.range });
        return;
      } catch {
        // CCS returned a location but the URI couldn't be opened — fall through to revealDefinition
      }
    }
  } finally {
    tokenSource.dispose();
  }

  await vscode.commands.executeCommand("editor.action.revealDefinition");
}
