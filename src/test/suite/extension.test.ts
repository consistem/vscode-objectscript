import * as assert from "assert";
import { before } from "mocha";
import * as path from "path";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import { extensionId, smExtensionId, OBJECTSCRIPT_FILE_SCHEMA } from "../../extension";
import { getUrisForDocument } from "../../utils/documentIndex";

async function waitForIndexedDocument(documentName: string, workspaceFolderName: string): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.find((wf) => wf.name === workspaceFolderName);
  assert.ok(workspaceFolder, `Workspace folder '${workspaceFolderName}' was not found.`);
  const start = Date.now();
  while (Date.now() - start < 10000) {
    if (getUrisForDocument(documentName, workspaceFolder).length > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`Timed out waiting for '${documentName}' to be indexed in workspace folder '${workspaceFolderName}'.`);
}

function getDefinitionTargets(definitions: (vscode.Location | vscode.DefinitionLink)[]): vscode.Uri[] {
  return definitions
    .map((definition) => ("targetUri" in definition ? definition.targetUri : definition.uri))
    .filter((uri): uri is vscode.Uri => !!uri);
}

suite("Extension Test Suite", () => {
  suiteSetup(async function () {
    // make sure extension is activated
    const serverManager = vscode.extensions.getExtension(smExtensionId);
    await serverManager?.activate();
    const ext = vscode.extensions.getExtension(extensionId);
    await ext?.activate();
  });

  before(() => {
    vscode.window.showInformationMessage("Start all tests.");
  });

  test("Sample test", () => {
    assert.ok("All good");
  });

  test("Go to Definition resolves to sibling workspace folder", async function () {
    this.timeout(10000);
    await waitForIndexedDocument("MultiRoot.Shared.cls", "shared");
    const clientFolder = vscode.workspace.workspaceFolders?.find((wf) => wf.name === "client");
    assert.ok(clientFolder, "Client workspace folder not available.");
    const callerUri = vscode.Uri.joinPath(clientFolder.uri, "src", "MultiRoot", "Caller.cls");
    const document = await vscode.workspace.openTextDocument(callerUri);
    await vscode.window.showTextDocument(document);

    const target = "MultiRoot.Shared";
    const sharedOffset = document.getText().indexOf(target);
    assert.notStrictEqual(sharedOffset, -1, "Shared class reference not found in Caller.cls");
    const position = document.positionAt(sharedOffset + target.indexOf("Shared") + 1);
    const definitions = (await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      callerUri,
      position
    )) as (vscode.Location | vscode.DefinitionLink)[];
    assert.ok(definitions?.length, "Expected at least one definition result");
    const targetUris = getDefinitionTargets(definitions);
    const sharedTargetSuffix = path.join("shared", "src", "MultiRoot", "Shared.cls");
    assert.ok(
      targetUris.some((uri) => uri.scheme === "file" && uri.fsPath.endsWith(sharedTargetSuffix)),
      "Expected Go to Definition to resolve to the shared workspace folder"
    );
  });

  test("Go to Definition falls back to server URI when local copy missing", async function () {
    this.timeout(10000);
    await waitForIndexedDocument("MultiRoot.Shared.cls", "shared");
    const clientFolder = vscode.workspace.workspaceFolders?.find((wf) => wf.name === "client");
    assert.ok(clientFolder, "Client workspace folder not available.");
    const callerUri = vscode.Uri.joinPath(clientFolder.uri, "src", "MultiRoot", "Caller.cls");
    const document = await vscode.workspace.openTextDocument(callerUri);
    await vscode.window.showTextDocument(document);

    const target = "MultiRoot.ServerOnly";
    const offset = document.getText().indexOf(target);
    assert.notStrictEqual(offset, -1, "Server-only class reference not found in Caller.cls");
    const position = document.positionAt(offset + target.indexOf("ServerOnly") + 1);
    const definitions = (await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      callerUri,
      position
    )) as (vscode.Location | vscode.DefinitionLink)[];
    assert.ok(definitions?.length, "Expected definition result when resolving missing class");
    const targetUris = getDefinitionTargets(definitions);
    assert.ok(
      targetUris.some((uri) => uri.scheme === OBJECTSCRIPT_FILE_SCHEMA),
      "Expected Go to Definition to return a server URI when no local copy exists"
    );
  });
});
