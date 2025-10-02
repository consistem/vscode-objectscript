export interface ResolveContextExpressionResponse {
  status?: string;
  textExpression?: string;
  message?: string;
}

export interface SourceControlError {
  message: string;
  cause?: unknown;
}
export interface GlobalDocumentationResponse {
  content?: string | string[] | Record<string, unknown> | null;
  message?: string;
}
