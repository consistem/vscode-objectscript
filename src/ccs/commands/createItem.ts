import * as vscode from "vscode";
import * as path from "path";

import { AtelierAPI } from "../../api";
import { getWsFolder, handleError } from "../../utils";
import { logDebug, logError, logInfo } from "../core/logging";
import { SourceControlApi } from "../sourcecontrol/client";
import { CreateItemClient } from "../sourcecontrol/clients/createItemClient";
import { getCcsSettings } from "../config/settings";

async function promptForItemName(): Promise<string | undefined> {
  const hasValidExt = (s: string) => /\.cls$/i.test(s) || /\.mac$/i.test(s);
  const hasBadChars = (s: string) => /[\\/]/.test(s) || /\s/.test(s);

  const ib = vscode.window.createInputBox();
  ib.title = "Create InterSystems Item";
  ib.prompt = "Enter the name of the class or routine to create (.cls or .mac)";
  ib.placeholder = "MyPackage.MyClass.cls or CCTRIB001.mac";
  ib.ignoreFocusOut = true;

  return await new Promise<string | undefined>((resolve) => {
    const disposeAll = () => {
      ib.dispose();
      d1.dispose();
      d2.dispose();
      d3.dispose();
    };

    // Do not show an error while typing (silent mode)
    const d1 = ib.onDidChangeValue(() => {
      ib.validationMessage = undefined;
    });

    // When pressing Enter, validate EVERYTHING and highlight in red if invalid
    const d2 = ib.onDidAccept(() => {
      const name = ib.value.trim();

      if (!name) {
        ib.validationMessage = { message: "Item name is required", severity: vscode.InputBoxValidationSeverity.Error };
        return;
      }
      if (hasBadChars(name)) {
        ib.validationMessage = {
          message: "Invalid name: avoid spaces and path separators",
          severity: vscode.InputBoxValidationSeverity.Error,
        };
        return;
      }
      if (!hasValidExt(name)) {
        ib.validationMessage = {
          message: "Please include a valid extension: .cls or .mac",
          severity: vscode.InputBoxValidationSeverity.Error,
        };
        return;
      }

      resolve(name);
      disposeAll();
    });

    const d3 = ib.onDidHide(() => {
      resolve(undefined);
      disposeAll();
    });

    ib.show();
  });
}

function ensureWorkspaceConnection(folder: vscode.WorkspaceFolder): AtelierAPI | undefined {
  const api = new AtelierAPI(folder.uri);
  if (!api.active) {
    void vscode.window.showErrorMessage("Workspace folder is not connected to an InterSystems server.");
    return undefined;
  }

  const { host, port } = api.config;
  if (!host || !port || !api.ns) {
    void vscode.window.showErrorMessage(
      "Workspace folder does not have a fully configured InterSystems server connection."
    );
    return undefined;
  }

  return api;
}

async function openCreatedFile(filePath: string): Promise<void> {
  // Ensure file exists before opening to avoid noisy errors
  const uri = vscode.Uri.file(filePath);
  await vscode.workspace.fs.stat(uri);
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, { preview: false });
}

function extractModuleName(filePath: string, ws: vscode.WorkspaceFolder): string | undefined {
  const rel = path.relative(ws.uri.fsPath, filePath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return undefined;

  const parts = rel.split(path.sep).filter(Boolean);
  // Drop filename
  parts.pop();
  if (!parts.length) return undefined;

  // Ignore common code folders
  const ignored = new Set(["src", "classes", "classescls", "mac", "int", "inc", "cls", "udl"]);
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i];
    if (!seg) continue;
    if (seg.endsWith(":")) continue; // Windows drive guard (e.g., "C:")
    if (ignored.has(seg.toLowerCase())) continue;
    return seg;
  }
  return undefined;
}

function isTimeoutError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as any).code === "ECONNABORTED";
}

async function withTimeoutRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 300): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isTimeoutError(e) || attempts <= 0) throw e;
    await new Promise((r) => setTimeout(r, delayMs));
    return withTimeoutRetry(fn, attempts - 1, delayMs);
  }
}

function getErrorMessage(err: unknown): string | undefined {
  // Try to extract a meaningful message without hard axios dependency
  const anyErr = err as any;
  if (anyErr?.response?.data) {
    const d = anyErr.response.data;
    if (typeof d === "string" && d.trim()) return d.trim();
    if (typeof d?.error === "string" && d.error.trim()) return d.error.trim();
    if (typeof d?.message === "string" && d.message.trim()) return d.message.trim();
    if (typeof d?.Message === "string" && d.Message.trim()) return d.Message.trim();
  }
  if (typeof anyErr?.message === "string" && anyErr.message.trim()) return anyErr.message.trim();
  return undefined;
}

export async function createItem(): Promise<void> {
  const workspaceFolder = await getWsFolder(
    "Pick the workspace folder where you want to create the item",
    false,
    false,
    false,
    true
  );

  if (workspaceFolder === undefined) {
    void vscode.window.showErrorMessage("No workspace folders are open.");
    return;
  }
  if (!workspaceFolder) {
    return;
  }

  const api = ensureWorkspaceConnection(workspaceFolder);
  if (!api) {
    return;
  }

  const ns = api.ns;
  if (!ns) {
    void vscode.window.showErrorMessage("Unable to determine active namespace for this workspace.");
    return;
  }
  const namespace = ns.toUpperCase();

  const itemName = await promptForItemName();
  if (!itemName) {
    return;
  }

  logDebug("CCS createItem invoked", { namespace, itemName });

  let sourceControlApi: SourceControlApi;
  try {
    sourceControlApi = SourceControlApi.fromAtelierApi(api);
  } catch (error) {
    handleError(error, "Failed to connect to the InterSystems SourceControl API.");
    return;
  }

  const createItemClient = new CreateItemClient(sourceControlApi);

  // Use configured requestTimeout to scale retry backoff (10%, clamped 150–500ms)
  const { requestTimeout } = getCcsSettings();
  const backoff = Math.min(500, Math.max(150, Math.floor(requestTimeout * 0.1)));

  try {
    const { data, status } = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Creating item...",
        cancellable: false,
      },
      async () => withTimeoutRetry(() => createItemClient.create(namespace, itemName), 2, backoff)
    );

    if (data.error) {
      logError("CCS createItem failed", { namespace, itemName, status, error: data.error });
      void vscode.window.showErrorMessage(data.error);
      return;
    }

    if (status < 200 || status >= 300) {
      const message = `Item creation failed with status ${status}.`;
      logError("CCS createItem failed", { namespace, itemName, status });
      void vscode.window.showErrorMessage(message);
      return;
    }

    if (!data.file) {
      const message = "Item created on server but no file path was returned.";
      logError("CCS createItem missing file path", { namespace, itemName, response: data });
      void vscode.window.showErrorMessage(message);
      return;
    }

    try {
      await openCreatedFile(data.file);
    } catch (openErr) {
      logError("Failed to open created file", { file: data.file, error: openErr });
      void vscode.window.showWarningMessage("Item created, but the returned file could not be opened.");
    }

    const createdNamespace = data.namespace ?? namespace;
    const createdItem = (data as any).itemIdCriado ?? itemName;
    const moduleName = extractModuleName(data.file, workspaceFolder);
    const location = moduleName ? `${createdNamespace}/${moduleName}` : createdNamespace;
    const successMessage = `Item created successfully in ${location}: ${createdItem}`;
    logInfo("CCS createItem succeeded", {
      namespace: createdNamespace,
      module: moduleName,
      itemName: createdItem,
      file: data.file,
    });
    void vscode.window.showInformationMessage(successMessage);
  } catch (error) {
    const errorMessage =
      (CreateItemClient as any).getErrorMessage?.(error) ??
      getErrorMessage(error) ??
      (isTimeoutError(error) ? "Item creation timed out." : "Item creation failed.");
    logError("CCS createItem encountered an unexpected error", error);
    void vscode.window.showErrorMessage(errorMessage);
  }
}
