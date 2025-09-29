import axios from "axios";
import * as vscode from "vscode";

import { AtelierAPI } from "../../../api";
import { getCcsSettings } from "../../config/settings";
import { createAbortSignal } from "../../core/http";
import { logDebug } from "../../core/logging";
import { ResolveDefinitionResponse } from "../../core/types";
import { SourceControlApi } from "../client";
import { ROUTES } from "../routes";
import { toVscodeLocation } from "../paths";

export class ResolveDefinitionClient {
  private readonly apiFactory: (api: AtelierAPI) => SourceControlApi;

  public constructor(apiFactory: (api: AtelierAPI) => SourceControlApi = SourceControlApi.fromAtelierApi) {
    this.apiFactory = apiFactory;
  }

  public async resolve(
    document: vscode.TextDocument,
    query: string,
    token: vscode.CancellationToken
  ): Promise<vscode.Location | undefined> {
    const api = new AtelierAPI(document.uri);
    const { host, port, username, password } = api.config;
    const namespace = api.ns;

    if (!api.active || !namespace || !host || !port || !username || !password) {
      logDebug("CCS definition lookup skipped due to missing connection metadata", {
        active: api.active,
        namespace,
        host,
        port,
        username: Boolean(username),
        password: Boolean(password),
      });
      return undefined;
    }

    let sourceControlApi: SourceControlApi;
    try {
      sourceControlApi = this.apiFactory(api);
    } catch (error) {
      logDebug("Failed to create SourceControl API client", error);
      return undefined;
    }

    const { requestTimeout } = getCcsSettings();
    const { signal, dispose } = createAbortSignal(token);

    try {
      const response = await sourceControlApi.post<ResolveDefinitionResponse>(
        ROUTES.resolveDefinition(namespace),
        { query },
        {
          timeout: requestTimeout,
          signal,
          validateStatus: (status) => status >= 200 && status < 300,
        }
      );

      const location = toVscodeLocation(response.data ?? {});
      if (!location) {
        logDebug("CCS definition lookup returned empty payload", response.data);
      }
      return location ?? undefined;
    } catch (error) {
      if (axios.isCancel(error)) {
        logDebug("CCS definition lookup cancelled");
        return undefined;
      }

      logDebug("CCS definition lookup failed", error);
      return undefined;
    } finally {
      dispose();
    }
  }
}
