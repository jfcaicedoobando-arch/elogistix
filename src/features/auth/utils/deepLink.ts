/**
 * Reglas de deep-link tras iniciar sesión (P-07).
 *
 * Cuando el guard de rutas manda al login desde una URL protegida, guardamos
 * la ruta original y volvemos a ella tras autenticar. Sólo se respeta si
 * pertenece al área del rol: evita open-redirects (`//evil.com`) y rebotes
 * infinitos entre el guard y el login.
 */

/** Prefijos de área por rol; el resto de roles vive en la app interna. */
const AREA_POR_ROL: Record<string, string> = {
  cliente: "/portal",
  agente_carga: "/agente",
};

const AREAS_EXTERNAS = Object.values(AREA_POR_ROL);

export function isDeepLinkPermitido(
  role: string | null | undefined,
  pathname?: string | null,
): boolean {
  if (!pathname) return false;
  // Ruta absoluta interna únicamente: `//host` y `http://…` son externas.
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return false;
  if (pathname === "/login" || pathname === "/") return false;

  const area = role ? AREA_POR_ROL[role] : undefined;
  if (area) return pathname === area || pathname.startsWith(`${area}/`);

  // Roles internos: nunca aterrizar en las áreas externas.
  return !AREAS_EXTERNAS.some(
    (externa) => pathname === externa || pathname.startsWith(`${externa}/`),
  );
}

/** Construye la URL de destino a partir del `location.state.from` guardado. */
export function resolveDeepLinkDestino(
  role: string | null | undefined,
  from?: { pathname?: string; search?: string } | null,
): string | null {
  if (!from?.pathname || !isDeepLinkPermitido(role, from.pathname)) return null;
  return `${from.pathname}${from.search ?? ""}`;
}
