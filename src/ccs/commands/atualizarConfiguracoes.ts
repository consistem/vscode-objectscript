import * as vscode from "vscode";

import { handleError, outputChannel } from "../../utils";
import { AtualizarConfigClient } from "../sourcecontrol/clients/atualizarConfigClient";

const sharedClient = new AtualizarConfigClient();

export async function atualizarConfiguracoes(): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Atualizando configurações e gerando backup...",
      cancellable: false,
    },
    async () => {
      try {
        const responseText = await sharedClient.atualizarConfig();
        renderOutput(responseText);
      } catch (error) {
        handleError(error, "Falha ao atualizar configurações e gerar backup.");
      }
    }
  );
}

function renderOutput(responseText: string): void {
  responseText
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .forEach((line) => outputChannel.appendLine(line));

  outputChannel.show(true);
}
