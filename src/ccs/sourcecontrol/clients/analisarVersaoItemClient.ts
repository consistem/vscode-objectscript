import * as vscode from "vscode";

import { AtelierAPI } from "../../../api";
import { getCcsSettings } from "../../config/settings";
import { createAbortSignal } from "../../core/http";
import { logDebug } from "../../core/logging";
import { SourceControlApi } from "../client";
import { ROUTES } from "../routes";

export interface AnalisarVersaoItemPayload {
  item: string;
  username: string;
  password: string;
}

export class AnalisarVersaoItemClient {
  private readonly apiFactory: (api: AtelierAPI) => SourceControlApi;

  public constructor(apiFactory: (api: AtelierAPI) => SourceControlApi = SourceControlApi.fromAtelierApi) {
    this.apiFactory = apiFactory;
  }

  public async analisar(
    document: vscode.TextDocument,
    payload: AnalisarVersaoItemPayload,
    token?: vscode.CancellationToken
  ): Promise<string> {
    const api = this.resolveApi(document);

    let sourceControlApi: SourceControlApi;
    try {
      sourceControlApi = this.apiFactory(api);
    } catch (error) {
      logDebug("Failed to create SourceControl API client for analisar versão do item", error);
      throw error;
    }

    const { analisarVersaoItemTimeout } = getCcsSettings();
    const { signal, dispose } = createAbortSignal(token);

    try {
      const response = await sourceControlApi.post<string>(ROUTES.analisarVersaoItem(api.ns), payload, {
        timeout: analisarVersaoItemTimeout,
        signal,
        responseType: "text",
        transformResponse: (data) => data,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      return typeof response.data === "string" ? response.data : "";
    } catch (error) {
      logDebug("Analisar versão do item request failed", error);
      throw error;
    } finally {
      dispose();
    }
  }

  private resolveApi(document: vscode.TextDocument): AtelierAPI {
    let api = new AtelierAPI(document.uri);

    if (!api.active || !api.ns) {
      const fallbackApi = new AtelierAPI();

      if (fallbackApi.active && fallbackApi.ns) {
        api = fallbackApi;
      } else {
        throw new Error(
          "Nenhum namespace ativo foi encontrado para analisar versão do item. Verifique a conexão ativa e tente novamente."
        );
      }
    }

    return api;
  }
}
