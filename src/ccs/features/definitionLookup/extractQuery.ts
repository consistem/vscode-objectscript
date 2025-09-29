import * as vscode from "vscode";

export type QueryKind = "labelRoutine" | "routine" | "macro" | "class";

export interface QueryMatch {
  query: string;
  normalizedQuery: string;
  kind: QueryKind;
  symbolName?: string;
}

export function extractDefinitionQuery(
  document: vscode.TextDocument,
  position: vscode.Position
): QueryMatch | undefined {
  const lineText = document.lineAt(position.line).text;
  const charIndex = position.character;

  const labelRoutine = findMatch(lineText, /\$\$([%A-Za-z][\w]*)\^([%A-Za-z][\w]*(?:\.[%A-Za-z][\w]*)*)/g, charIndex);
  if (labelRoutine) {
    const [, , routineName] = labelRoutine.match;
    const normalizedQuery = labelRoutine.text.replace(/^\$\$+/, "");
    return {
      query: labelRoutine.text,
      normalizedQuery,
      kind: "labelRoutine",
      symbolName: routineName,
    };
  }

  const caretRoutine = findMatch(lineText, /\^(%?[A-Za-z][\w]*(?:\.[%A-Za-z][\w]*)*)/g, charIndex);
  if (caretRoutine) {
    const [, routineName] = caretRoutine.match;
    return {
      query: caretRoutine.text,
      normalizedQuery: caretRoutine.text,
      kind: "routine",
      symbolName: routineName,
    };
  }

  const macro = findMatch(lineText, /\${3}([%A-Za-z][%A-Za-z0-9_]*)/g, charIndex);
  if (macro) {
    const [, macroName] = macro.match;
    return {
      query: macro.text,
      normalizedQuery: macro.text,
      kind: "macro",
      symbolName: macroName,
    };
  }

  const classRef = findMatch(
    lineText,
    /##class\s*\(\s*([%A-Za-z][\w]*(?:\.[%A-Za-z][\w]*)*)\s*\)(?:\s*\.\s*([%A-Za-z][\w]*))?/gi,
    charIndex
  );
  if (classRef) {
    const [, className, methodName] = classRef.match;
    const normalizedQuery = methodName ? `##class(${className}).${methodName}` : `##class(${className})`;
    return {
      query: classRef.text,
      normalizedQuery,
      kind: "class",
      symbolName: className,
    };
  }

  return undefined;
}

interface MatchResult {
  text: string;
  match: RegExpExecArray;
}

function findMatch(line: string, regex: RegExp, character: number): MatchResult | undefined {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (character >= start && character <= end) {
      return { text: match[0], match };
    }
  }
  return undefined;
}
