import axios from "axios";
import * as path from "path";
import * as vscode from "vscode";

import { AtelierAPI } from "../../api";
import { currentFile, handleError, outputChannel } from "../../utils";
import { AnalisarVersaoItemClient } from "../sourcecontrol/clients/analisarVersaoItemClient";

const sharedClient = new AnalisarVersaoItemClient();

export async function analisarVersaoItem(): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    void vscode.window.showErrorMessage("Nenhum arquivo ativo para analisar versão do item.");
    return;
  }

  // Para classes precisamos do nome completo do documento (ex.: `Fat.NotaFiscal.cls`),
  // não apenas do nome do arquivo. `currentFile` extrai o nome real do conteúdo
  // (declaração `Class`/`ROUTINE`); só usamos o basename como último recurso.
  const item = currentFile(editor.document)?.name ?? path.basename(editor.document.fileName);

  if (!item) {
    void vscode.window.showErrorMessage("Nome do item não disponível para analisar versão.");
    return;
  }

  const api = resolveApi(editor.document);

  if (!api) {
    return;
  }

  const { username, password } = api.config.auth;

  if (typeof username !== "string" || typeof password !== "string") {
    void vscode.window.showErrorMessage("Credenciais não disponíveis para analisar versão do item.");
    return;
  }

  try {
    const responseText = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Analisando versões do item ${item}...`,
        cancellable: true,
      },
      (_progress, token) => sharedClient.analisar(editor.document, { item, username, password }, token)
    );

    if (!responseText || !responseText.trim()) {
      void vscode.window.showInformationMessage("Analisar Versão do Item não retornou nenhum conteúdo.");
      return;
    }

    renderToOutput(responseText);
  } catch (error) {
    if (axios.isCancel(error)) {
      return;
    }

    if (isTimeoutError(error)) {
      void vscode.window.showErrorMessage(
        "A análise de versões do item excedeu o tempo limite. Aumente `consistem.analisarVersaoItem.timeout` nas configurações de usuário e tente novamente."
      );
      return;
    }

    handleError(error, "Falha ao analisar versão do item.");
  }
}

function isTimeoutError(error: unknown): boolean {
  const code = axios.isAxiosError(error) ? error.code : undefined;
  return code === "ECONNABORTED" || code === "ETIMEDOUT";
}

function resolveApi(document: vscode.TextDocument): AtelierAPI | undefined {
  let api = new AtelierAPI(document.uri);

  if (!api.active || !api.ns) {
    const fallbackApi = new AtelierAPI();

    if (fallbackApi.active && fallbackApi.ns) {
      api = fallbackApi;
    } else {
      void vscode.window.showErrorMessage(
        "Nenhum namespace ativo foi encontrado. Verifique a conexão ativa e tente novamente."
      );
      return undefined;
    }
  }

  return api;
}

function renderToOutput(responseText: string): void {
  responseText
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .forEach((line) => outputChannel.appendLine(line));

  outputChannel.show(true);
}
