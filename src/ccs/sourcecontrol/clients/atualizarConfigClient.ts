import * as vscode from "vscode";

import { AtelierAPI } from "../../../api";
import { createAbortSignal } from "../../core/http";
import { logDebug } from "../../core/logging";
import { SourceControlApi } from "../client";
import { ROUTES } from "../routes";

const DESENV_NS_PATTERN = /^DESENV\d+$/i;

export class AtualizarConfigClient {
  private readonly apiFactory: (api: AtelierAPI) => SourceControlApi;

  public constructor(apiFactory: (api: AtelierAPI) => SourceControlApi = SourceControlApi.fromAtelierApi) {
    this.apiFactory = apiFactory;
  }

  public async atualizarConfig(): Promise<string> {
    const api = this.resolveDesenvApi();

    let sourceControlApi: SourceControlApi;
    try {
      sourceControlApi = this.apiFactory(api);
    } catch (error) {
      logDebug("Failed to create SourceControl API client para atualizarConfig", error);
      throw error;
    }

    const { signal, dispose } = createAbortSignal();

    try {
      const response = await sourceControlApi.post<string>(ROUTES.atualizarConfig(api.ns), {}, {
        timeout: 0,
        signal,
        responseType: "text",
        transformResponse: (data) => data,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      return typeof response.data === "string" ? response.data : "";
    } catch (error) {
      logDebug("atualizarConfig request failed", error);
      throw error;
    } finally {
      dispose();
    }
  }

  private resolveDesenvApi(): AtelierAPI {
    for (const wsFolder of vscode.workspace.workspaceFolders ?? []) {
      if (!DESENV_NS_PATTERN.test(wsFolder.name)) continue;
      const api = new AtelierAPI(wsFolder.uri);
      if (!api.active) continue;
      return api;
    }

    throw new Error(
      "Namespace DESENVXX não encontrado. Verifique as configurações do workspace."
    );
  }
}
