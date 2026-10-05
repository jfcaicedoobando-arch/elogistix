export interface ClientErrorPayload {
  message?: unknown;
  stack?: unknown;
  component_stack?: unknown;
  route?: unknown;
  user_agent?: unknown;
  app_version?: unknown;
}

/** El JSON raíz debe ser un objeto; los campos se truncan después como antes. */
export function esClientErrorPayload(value: unknown): value is ClientErrorPayload {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
