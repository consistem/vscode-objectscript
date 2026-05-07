import * as vscode from "vscode";

import { AtelierAPI } from "../../../api";
import { getCcsSettings } from "../../config/settings";
import { createAbortSignal } from "../../core/http";
import { logDebug } from "../../core/logging";
import { SourceControlApi } from "../client";
import { ROUTES } from "../routes";

export interface AnalizarVersaoItemPayload {
  item: string;
  username: string;
  password: string;
}

export class AnalizarVersaoItemClient {
  private readonly apiFactory: (api: AtelierAPI) => SourceControlApi;

  public constructor(apiFactory: (api: AtelierAPI) => SourceControlApi = SourceControlApi.fromAtelierApi) {
    this.apiFactory = apiFactory;
  }

  public async analisar(
    document: vscode.TextDocument,
    payload: AnalizarVersaoItemPayload,
    token?: vscode.CancellationToken
  ): Promise<string> {
    const api = this.resolveApi(document);

    let sourceControlApi: SourceControlApi;
    try {
      sourceControlApi = this.apiFactory(api);
    } catch (error) {
      logDebug("Failed to create SourceControl API client for analizar versão do item", error);
      throw error;
    }

    const { requestTimeout } = getCcsSettings();
    const { signal, dispose } = createAbortSignal(token);

    try {
      const response = await sourceControlApi.post<string>(ROUTES.analizarVersaoItem(api.ns), payload, {
        timeout: requestTimeout,
        signal,
        responseType: "text",
        transformResponse: (data) => data,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      return typeof response.data === "string" ? response.data : "";
    } catch (error) {
      logDebug("Analizar versão do item request failed", error);
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
          "Nenhum namespace ativo foi encontrado para analizar versão do item. Verifique a conexão ativa e tente novamente."
        );
      }
    }

    return api;
  }
}
