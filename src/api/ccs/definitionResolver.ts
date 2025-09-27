import { AtelierAPI } from "../";
import { SourceControlApi } from "./sourceControl";

export interface DefinitionResolverResult {
  uri: string;
  line?: number;
  column?: number;
}

export class DefinitionResolverApi {
  private readonly sourceControlApi: SourceControlApi;
  private readonly namespace: string;

  private constructor(sourceControlApi: SourceControlApi, namespace: string) {
    this.sourceControlApi = sourceControlApi;
    this.namespace = namespace;
  }

  public static fromAtelierApi(api: AtelierAPI): DefinitionResolverApi {
    const namespace = api.ns;

    const sourceControlApi = SourceControlApi.fromAtelierApi(api);

    return new DefinitionResolverApi(sourceControlApi, namespace);
  }

  public async resolve(query: string): Promise<DefinitionResolverResult | undefined> {
    if (!query || !this.namespace) {
      return undefined;
    }

    try {
      const response = await this.sourceControlApi.post<DefinitionResolverResult>(
        `/namespaces/${encodeURIComponent(this.namespace)}/resolveDefinition`,
        { query }
      );
      const data = response.data;
      if (data && typeof data.uri === "string" && data.uri.length > 0) {
        return data;
      }
    } catch (error) {
      // Ignore errors and let the caller fall back to the default provider logic.
    }

    return undefined;
  }
}
