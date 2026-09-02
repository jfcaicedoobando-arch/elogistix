/**
 * Derivación de la lista de vendedores disponibles a partir de usuarios.
 *
 * v13.823.49 — el filtrado en memoria de oportunidades se eliminó: etapa,
 * vendedor, rango de cierre y monto mínimo se aplican server-side.
 */
import { useMemo } from "react";
import type { UserRow } from "@/features/admin/hooks/usuario";

const ROLES_VENDEDOR = ["admin", "operador", "vendedor", "gerente_comercial", "super_admin"];

export function useVendedoresDisponibles(usuarios: UserRow[]) {
  return useMemo(
    () =>
      usuarios
        .filter((u) => ROLES_VENDEDOR.includes(u.role))
        .map((u) => ({ id: u.user_id, email: u.email })),
    [usuarios],
  );
}
