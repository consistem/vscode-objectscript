import * as vscode from "vscode";

import { extractDefinitionQueries } from "../features/definitionLookup/extractQuery";

export const followDefinitionLinkCommand = "vscode-objectscript.ccs.followDefinitionLink";

export class DefinitionDocumentLinkProvider implements vscode.DocumentLinkProvider {
  public provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
    const links: vscode.DocumentLink[] = [];
    const queries = extractDefinitionQueries(document);

    for (const match of queries) {
      const args = [document.uri.toString(), match.range.start.line, match.range.start.character];
      const commandUri = vscode.Uri.parse(
        `command:${followDefinitionLinkCommand}?${encodeURIComponent(JSON.stringify(args))}`
      );
      const link = new vscode.DocumentLink(match.range, commandUri);
      link.tooltip = vscode.l10n.t("Go to Definition");
      links.push(link);
    }

    return links;
  }
}
