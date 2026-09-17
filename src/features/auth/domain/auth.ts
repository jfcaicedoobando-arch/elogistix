/**
 * Lógica pura de routing post-login. Sin acceso a datos.
 */
export type PostLoginRole =
  | "super_admin"
  | "cliente"
  | "operador"
  | "admin"
  | "viewer"
  | "agente_carga"
  | null;

/**
 * Resuelve la ruta a la que debe ser enviado un usuario tras iniciar sesión
 * en función de su rol principal. Acepta cualquier rol del catálogo (los que
 * no tienen portal propio aterrizan en `/inicio`).
 */
export function resolveLandingRoute(role: PostLoginRole | string): string {
  if (role === "super_admin") return "/admin";
  if (role === "cliente") return "/portal";
  if (role === "agente_carga") return "/agente";
  return "/inicio";
}
