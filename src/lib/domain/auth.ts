/**
 * Lógica pura de routing post-login. Sin acceso a datos.
 */
export type PostLoginRole = "super_admin" | "cliente" | "operador" | "admin" | "viewer" | null;

/**
 * Resuelve la ruta a la que debe ser enviado un usuario tras iniciar sesión
 * en función de su rol principal.
 */
export function resolveLandingRoute(role: PostLoginRole): string {
  if (role === "super_admin") return "/admin";
  if (role === "cliente") return "/portal";
  return "/";
}
