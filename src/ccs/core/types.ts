export interface ResolveContextExpressionResponse {
  status?: string;
  textExpression?: string;
  message?: string;
}

export interface SourceControlError {
  message: string;
  cause?: unknown;
}
