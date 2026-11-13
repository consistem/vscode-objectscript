/**
 * Consistem: continuação automática de linhas com prefixo de ponto (`. `) em rotinas .mac/.int.
 * Não depende de servidor; roda em qualquer launch da matriz de casos.
 */
import * as assert from "assert";
import * as vscode from "vscode";

const EXTENSION_ID = "consistem-sistemas.consistem-vscode-objectscript";

async function waitForCondition(predicate: () => boolean, timeoutMs = 1000, message?: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(message ?? "Timed out waiting for condition");
}

suite("Dot-prefixed indentation", () => {
  suiteSetup(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  test("Dot-prefixed statements continue on newline", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: "objectscript",
      content: "    . Do ##class(Test).Run()",
    });
    const editor = await vscode.window.showTextDocument(document);
    try {
      await editor.edit((editBuilder) => {
        editBuilder.insert(document.lineAt(0).range.end, "\n");
      });
      await waitForCondition(() => document.lineCount > 1);
      await waitForCondition(() => document.lineAt(1).text.length > 0);
      assert.strictEqual(document.lineAt(1).text, "    . ");
    } finally {
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }
  });

  test("Dot-prefixed semicolon comments continue on newline", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: "objectscript",
      content: "  . ; Comment",
    });
    const editor = await vscode.window.showTextDocument(document);
    try {
      await editor.edit((editBuilder) => {
        editBuilder.insert(document.lineAt(0).range.end, "\n");
      });
      await waitForCondition(() => document.lineCount > 1);
      await waitForCondition(() => document.lineAt(1).text.length > 0);
      assert.strictEqual(document.lineAt(1).text, "  . ;");
    } finally {
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }
  });

  test("Moving lines across dot-prefixed semicolon comments doesn't add semicolons", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: "objectscript",
      content: "  . Do ##class(Test).Run()\n  . ; Comment",
    });
    const editor = await vscode.window.showTextDocument(document);
    try {
      editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));
      await vscode.commands.executeCommand("editor.action.moveLinesDownAction");
      const expectedText = "  . ; Comment\n  . Do ##class(Test).Run()";
      await waitForCondition(() => document.getText() === expectedText);
      assert.strictEqual(document.getText(), expectedText);
    } finally {
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }
  });
});
