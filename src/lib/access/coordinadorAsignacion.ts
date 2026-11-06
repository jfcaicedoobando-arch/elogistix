import type { AppRole } from "@/types/appRole";

const ROLES_ASIGNADORES: ReadonlyArray<AppRole> = ["gerente_operaciones", "admin", "admin_org", "super_admin"];

/** Sólo Operaciones (gerente) y Administración cambian al coordinador; el RPC lo vuelve a validar. */
export function puedeAsignarCoordinador(rol: AppRole | null): boolean {
  return rol != null && ROLES_ASIGNADORES.includes(rol);
}
