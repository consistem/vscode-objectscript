export const BASE_PATH = "/api/sourcecontrol/vscode" as const;

export const ROUTES = {
  resolveContextExpression: () => `/resolveContextExpression`,
} as const;

export type RouteKey = keyof typeof ROUTES;
