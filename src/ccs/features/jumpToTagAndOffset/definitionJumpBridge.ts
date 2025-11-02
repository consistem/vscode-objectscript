import * as vscode from "vscode";
import { resolveRoutineJump } from "./resolveRoutineJump";

export async function maybeHandleDefinitionAccept(quickPick: vscode.QuickPick<vscode.QuickPickItem>): Promise<boolean> {
  const raw = (quickPick.value ?? "").trim();
  if (!raw.includes("^")) {
    return false;
  }

  const caretIndex = raw.indexOf("^");
  const labelSegment = raw.slice(0, caretIndex).replace(/\s+/g, "");
  const targetSegment = raw.slice(caretIndex + 1).replace(/\s+/g, "");

  // Hoje: tratamos como Rotina; amanhã: detectar Classe aqui (ex.: ClassName.Method)
  const labelMatch = labelSegment.match(/^(%?[A-Za-z][\w]*)(?:\+(\d+))?$/);
  const routineMatch = targetSegment.match(/^%?[A-Za-z][\w]*$/);

  if (!labelMatch || !routineMatch) {
    vscode.window.showWarningMessage("Formato inválido. Use Label+Offset ou Label+Offset^Destino");
    return true;
  }

  const [, labelName, offsetPart] = labelMatch;
  const routineName = routineMatch[0];
  const offsetValue = offsetPart ? parseInt(offsetPart, 10) : 0;

  quickPick.hide();
  await resolveRoutineJump({ routine: routineName, label: labelName, offset: offsetValue });
  return true;
}
