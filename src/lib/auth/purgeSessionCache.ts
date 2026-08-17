/**
 * EC-01 (auditoría v13.627.1) — Purga del caché de React Query al cambiar de
 * sesión. Las query keys de dominio (`embarques`, `cxp`, …) NO incluyen el
 * `organization_id`, así que en una pestaña compartida el siguiente usuario
 * podría ver datos del tenant saliente hasta que expire el `staleTime`.
 */
import type { QueryClient } from "@tanstack/react-query";

export function purgeSessionCache(queryClient: QueryClient): void {
  queryClient.clear();
}

/**
 * ¿Debe purgarse el caché? Sólo cuando entra un usuario DISTINTO al previo
 * (cambio de sesión sin `signOut` explícito). Pura y testeable.
 */
export function debePurgarPorCambioDeUsuario(
  lastEvent: string | null | undefined,
  prevUserId: string | null,
  currentUserId: string | null,
): boolean {
  return (
    lastEvent === "SIGNED_IN" &&
    Boolean(currentUserId) &&
    Boolean(prevUserId) &&
    prevUserId !== currentUserId
  );
}
