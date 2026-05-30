import axios from "axios";
import * as httpsModule from "https";
import * as vscode from "vscode";

// Inline dos schemas ISFS para evitar dependência circular com utils/extension
const ISFS_SCHEMES = ["isfs", "isfs-readonly"];

function isClientSideFolder(uri: vscode.Uri): boolean {
  return !ISFS_SCHEMES.includes(uri.scheme);
}

function getFolderConn(folderUri: vscode.Uri): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("objectscript", folderUri);
}

function getConnValue(folderConfig: vscode.WorkspaceConfiguration): Record<string, any> | undefined {
  const inspect = folderConfig.inspect("conn");
  return (inspect?.workspaceFolderValue ?? inspect?.workspaceValue) as Record<string, any> | undefined;
}

function getConnTarget(folderConfig: vscode.WorkspaceConfiguration): vscode.ConfigurationTarget {
  return folderConfig.inspect("conn")?.workspaceFolderValue
    ? vscode.ConfigurationTarget.WorkspaceFolder
    : vscode.ConfigurationTarget.Workspace;
}

/**
 * Testa se o servidor responde fazendo uma requisição HTTP direta.
 * Qualquer resposta HTTP (incluindo 401) indica que o servidor está ativo.
 */
async function isServerReachable(host: string, port: number, secure: boolean, pathPrefix: string): Promise<boolean> {
  if (!host || !port) return false;

  const proto = secure ? "https" : "http";
  let prefix = (pathPrefix ?? "").trim();
  if (prefix.length && !prefix.startsWith("/")) prefix = "/" + prefix;
  const url = `${proto}://${host}:${port}${prefix}/api/atelier`;

  try {
    const strictSSL = vscode.workspace.getConfiguration("http").get<boolean>("proxyStrictSSL") ?? true;
    const httpsAgent = new httpsModule.Agent({ rejectUnauthorized: strictSSL });
    await axios.get(url, {
      httpsAgent,
      timeout: 5000,
      validateStatus: (status) => status < 500,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ativa os workspace folders inativos que usam o mesmo servidor (host:port)
 * do folder que acabou de conectar com sucesso. Chamado automaticamente após
 * uma conexão bem-sucedida para restaurar os namespaces relacionados.
 * Retorna a quantidade de folders ativados.
 */
export async function activateSiblingFolders(host: string, port: number): Promise<number> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  let count = 0;

  for (const folder of folders) {
    if (!isClientSideFolder(folder.uri)) continue;

    const folderConfig = getFolderConn(folder.uri);
    const connValue = getConnValue(folderConfig);
    if (!connValue) continue;

    // Apenas folders no mesmo servidor que estão inativos
    if (connValue.active !== false) continue;
    if (connValue.host !== host || connValue.port !== port) continue;

    await folderConfig.update("conn", { ...connValue, active: true }, getConnTarget(folderConfig));
    count++;
  }

  return count;
}

export interface ReactivationResult {
  success: boolean;
  activatedCount: number;
  activatedFolderUris: vscode.Uri[];
  errorMessage?: string;
}

/**
 * Chamado pelo botão manual no Explorer. Valida conectividade com o servidor
 * antes de reativar todos os workspace folders com conexão direta inativa.
 */
export async function reactivateNamespaceConnections(): Promise<ReactivationResult> {
  const allFolders = (vscode.workspace.workspaceFolders ?? []).filter((f) => isClientSideFolder(f.uri));

  if (!allFolders.length) {
    return {
      success: false,
      activatedCount: 0,
      activatedFolderUris: [],
      errorMessage: "Nenhum workspace folder local encontrado.",
    };
  }

  // Mapeia servidores únicos e lista os folders inativos
  const serverMap = new Map<string, { host: string; port: number; secure: boolean; pathPrefix: string }>();
  const inactiveFolders: Array<{ folder: vscode.WorkspaceFolder; connValue: Record<string, any> }> = [];

  for (const folder of allFolders) {
    const folderConfig = getFolderConn(folder.uri);
    const connValue = getConnValue(folderConfig);
    if (!connValue?.host || !connValue?.port) continue;

    const key = `${connValue.host}:${connValue.port}`;
    if (!serverMap.has(key)) {
      serverMap.set(key, {
        host: connValue.host,
        port: connValue.port,
        secure: connValue.https ?? false,
        pathPrefix: connValue.pathPrefix ?? "",
      });
    }

    if (connValue.active === false) {
      inactiveFolders.push({ folder, connValue });
    }
  }

  if (!serverMap.size) {
    return {
      success: false,
      activatedCount: 0,
      activatedFolderUris: [],
      errorMessage: "Nenhuma configuração de servidor encontrada nos workspace folders.",
    };
  }

  if (!inactiveFolders.length) {
    return { success: true, activatedCount: 0, activatedFolderUris: [] };
  }

  // Valida quais servidores estão acessíveis
  const reachableKeys = new Set<string>();
  for (const [key, info] of serverMap) {
    if (await isServerReachable(info.host, info.port, info.secure, info.pathPrefix)) {
      reachableKeys.add(key);
    }
  }

  if (!reachableKeys.size) {
    return {
      success: false,
      activatedCount: 0,
      activatedFolderUris: [],
      errorMessage: "Não foi possível conectar ao servidor. Verifique se o servidor está acessível e tente novamente.",
    };
  }

  // Ativa os folders inativos dos servidores alcançáveis
  const activatedFolderUris: vscode.Uri[] = [];
  for (const { folder, connValue } of inactiveFolders) {
    const key = `${connValue.host}:${connValue.port}`;
    if (!reachableKeys.has(key)) continue;

    const folderConfig = getFolderConn(folder.uri);
    await folderConfig.update("conn", { ...connValue, active: true }, getConnTarget(folderConfig));
    activatedFolderUris.push(folder.uri);
  }

  return { success: true, activatedCount: activatedFolderUris.length, activatedFolderUris };
}
