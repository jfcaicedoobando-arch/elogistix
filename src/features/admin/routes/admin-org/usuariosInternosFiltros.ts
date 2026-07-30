/**
 * Lógica pura de filtrado y orden del listado de usuarios internos.
 * Extraída de `UsuariosInternosTab.tsx` para poder probarla sin renderizar
 * (U-06 / U-08, auditoría 2026-07-30).
 */
import type { UserRow } from "@/features/admin/services/usuario";
import { esRolLegacy, obtenerRangoRol } from "@/features/admin/domain/roles/roleCatalog";

export const TODOS = "todos" as const;

export interface FiltrosUsuarios {
  busqueda: string;
  rol: string;
  estado: string;
}

function coincideEstado(u: UserRow, estado: string): boolean {
  if (estado === TODOS) return true;
  if (estado === "legacy") return esRolLegacy(u.role);
  return u.estado === estado;
}

export function filtrarUsuarios(users: UserRow[], filtros: FiltrosUsuarios): UserRow[] {
  const busqueda = filtros.busqueda.trim().toLowerCase();
  const base = users.filter((u) => {
    if (filtros.rol !== TODOS && u.role !== filtros.rol) return false;
    if (!coincideEstado(u, filtros.estado)) return false;
    if (busqueda && !u.email.toLowerCase().includes(busqueda)) return false;
    return true;
  });
  return [...base].sort((a, b) => {
    const ra = obtenerRangoRol(a.role);
    const rb = obtenerRangoRol(b.role);
    if (ra !== rb) return ra - rb;
    return a.email.localeCompare(b.email, "es-MX", { sensitivity: "base" });
  });
}

export function hayFiltrosActivos(filtros: FiltrosUsuarios): boolean {
  return (
    !!filtros.busqueda.trim() || filtros.rol !== TODOS || filtros.estado !== TODOS
  );
}
