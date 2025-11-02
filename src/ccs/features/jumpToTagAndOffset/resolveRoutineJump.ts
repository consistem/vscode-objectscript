import * as vscode from "vscode";

import { ResolveDefinitionClient } from "../../sourcecontrol/clients/resolveDefinitionClient";
import { handleError } from "../../../utils";

const sharedClient = new ResolveDefinitionClient();

export interface RoutineJumpParams {
  routine: string;
  label: string;
  offset: number;
}

export async function resolveRoutineJump({ routine, label, offset }: RoutineJumpParams): Promise<void> {
  const sourceDocument = vscode.window.activeTextEditor?.document;
  if (!sourceDocument) {
    return;
  }

  const cancellation = new vscode.CancellationTokenSource();
  try {
    const location = await sharedClient.resolve(sourceDocument, `${label}^${routine}`, cancellation.token);
    if (!location) {
      const routineCancellation = new vscode.CancellationTokenSource();
      try {
        const routineLocation = await sharedClient.resolve(sourceDocument, `^${routine}`, routineCancellation.token);
        if (!routineLocation) {
          vscode.window.showWarningMessage(`Rotina ${routine} não encontrada no workspace atual`);
          return;
        }
      } finally {
        routineCancellation.dispose();
      }
      vscode.window.showWarningMessage(`Label ${label} não encontrada em ${routine}`);
      return;
    }

    const targetDocument = await vscode.workspace.openTextDocument(location.uri);
    const labelLine = location.range.start.line;
    const lastLineIndex = Math.max(0, targetDocument.lineCount - 1);
    const targetLine = Math.min(lastLineIndex, Math.max(0, labelLine + offset));
    const position = new vscode.Position(targetLine, 0);
    const editor = await vscode.window.showTextDocument(targetDocument);
    const selection = new vscode.Selection(position, position);
    editor.selection = selection;
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.AtTop);
  } catch (error) {
    handleError(error, `Não foi possível abrir a rotina '${routine}'.`);
  } finally {
    cancellation.dispose();
  }
}
