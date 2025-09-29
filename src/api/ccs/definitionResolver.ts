import axios, { AxiosInstance } from "axios";
import * as vscode from "vscode";
import { AtelierAPI } from "../";

interface ResolveDefinitionResponse {
  uri?: string;
  line?: number;
}

export class DefinitionResolverApiClient {
  private readonly axiosInstance: AxiosInstance;

  public constructor(axiosInstance: AxiosInstance = axios) {
    this.axiosInstance = axiosInstance;
  }

  public async resolve(
    document: vscode.TextDocument,
    query: string,
    token: vscode.CancellationToken,
    timeout = 500
  ): Promise<vscode.Location | undefined> {
    const api = new AtelierAPI(document.uri);
    const { https, host, port, pathPrefix, username, password } = api.config;
    const ns = api.ns;

    if (!api.active || !ns || !host || !username || !password || !port) {
      return undefined;
    }

    const normalizedPrefix = pathPrefix ? (pathPrefix.startsWith("/") ? pathPrefix : `/${pathPrefix}`) : "";
    const trimmedPrefix = normalizedPrefix.endsWith("/") ? normalizedPrefix.slice(0, -1) : normalizedPrefix;
    const baseUrl = `${https ? "https" : "http"}://${host}:${port}${trimmedPrefix}`;
    const requestUrl = `${baseUrl}/api/sourcecontrol/vscode/namespaces/${encodeURIComponent(ns)}/resolveDefinition`;

    const controller = new AbortController();
    const disposeCancellation = token.onCancellationRequested(() => controller.abort());

    try {
      const response = await this.axiosInstance.post<ResolveDefinitionResponse>(
        requestUrl,
        { query },
        {
          auth: { username, password },
          headers: { "Content-Type": "application/json" },
          timeout,
          signal: controller.signal,
          validateStatus: (status) => status >= 200 && status < 300,
        }
      );

      const data = response.data;
      if (data && typeof data.uri === "string" && data.uri.length && typeof data.line === "number") {
        const zeroBasedLine = Math.max(0, Math.floor(data.line) - 1);
        const targetUri = vscode.Uri.file(data.uri.replace(/\\/g, "/"));
        return new vscode.Location(targetUri, new vscode.Position(zeroBasedLine, 0));
      }
    } catch (error) {
      if (!axios.isCancel(error)) {
        // Swallow any errors to allow the native provider to handle the request.
      }
    } finally {
      disposeCancellation.dispose();
    }

    return undefined;
  }
}
