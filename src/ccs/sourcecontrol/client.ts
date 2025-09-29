import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import * as https from "https";
import * as vscode from "vscode";
import { AtelierAPI } from "../../api";

export class SourceControlApi {
  private readonly client: AxiosInstance;

  private constructor(client: AxiosInstance) {
    this.client = client;
  }

  public static fromAtelierApi(api: AtelierAPI): SourceControlApi {
    const { host, port, username, password, https: useHttps, pathPrefix } = api.config;

    if (!host || !port) {
      throw new Error("No active InterSystems server connection for this file.");
    }

    const normalizedPrefix = pathPrefix ? (pathPrefix.startsWith("/") ? pathPrefix : `/${pathPrefix}`) : "";
    const baseUrl = `${useHttps ? "https" : "http"}://${host}:${port}${encodeURI(normalizedPrefix)}`;

    const httpsAgent = new https.Agent({
      rejectUnauthorized: vscode.workspace.getConfiguration("http").get("proxyStrictSSL"),
    });

    const client = axios.create({
      baseURL: `${baseUrl}/api/sourcecontrol/vscode`,
      headers: {
        "Content-Type": "application/json",
      },
      httpsAgent,
      auth:
        typeof username === "string" && typeof password === "string"
          ? {
              username,
              password,
            }
          : undefined,
    });

    return new SourceControlApi(client);
  }

  public post<T = unknown, R = AxiosResponse<T>>(
    endpoint: string,
    data?: unknown,
    config?: AxiosRequestConfig<unknown>
  ): Promise<R> {
    return this.client.post<T, R>(endpoint, data, config);
  }
}
