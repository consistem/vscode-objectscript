export interface LocationJSON {
  uri?: string;
  line?: number;
}

export interface ResolveDefinitionResponse extends LocationJSON {}

export interface ResolveContextExpressionResponse {
  status?: string;
  textExpression?: string;
  message?: string;
}

export interface SourceControlError {
  message: string;
  cause?: unknown;
}
