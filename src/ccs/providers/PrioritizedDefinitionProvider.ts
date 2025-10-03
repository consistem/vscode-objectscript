import * as vscode from "vscode";

import { ObjectScriptDefinitionProvider } from "../../providers/ObjectScriptDefinitionProvider";
import { logDebug } from "../core/logging";
import { lookupCcsDefinition } from "../features/definitionLookup/lookup";

const shouldLogResolver = Boolean(process.env.VSCODE_OBJECTSCRIPT_DEBUG_CCS_RESOLVER);

export class PrioritizedDefinitionProvider implements vscode.DefinitionProvider {
  private readonly delegate?: ObjectScriptDefinitionProvider;
  private readonly lookup: typeof lookupCcsDefinition;

  public constructor(
    delegate?: ObjectScriptDefinitionProvider,
    lookupFn: typeof lookupCcsDefinition = lookupCcsDefinition
  ) {
    this.delegate = delegate;
    this.lookup = lookupFn;
  }

  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Location | vscode.Location[] | vscode.DefinitionLink[] | undefined> {
    const location = await this.lookup(document, position, token, {
      onNoResult: () => {
        // No result from CCS resolver, fallback will be triggered
      },
    });
    if (location) {
      this.logResolverPath("Resolved definition via CCS", {
        uri: location.uri.toString(),
        line: location.range.start.line,
      });
      return location;
    }

    if (!this.delegate) {
      this.logResolverPath("CCS definition lookup returned no result; no delegate available");
      return undefined;
    }

    this.logResolverPath("CCS definition lookup returned no result; invoking delegate fallback");
    return this.delegate.provideDefinition(document, position, token);
  }

  private logResolverPath(message: string, details?: Record<string, unknown>): void {
    if (!shouldLogResolver) {
      return;
    }
    if (details) {
      logDebug(message, details);
    } else {
      logDebug(message);
    }
  }
}
