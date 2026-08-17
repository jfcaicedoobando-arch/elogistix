/**
 * Filtrado en memoria de oportunidades (etapa, vendedor, fechas, monto) y
 * derivación de la lista de vendedores disponibles a partir de usuarios.
 */
import { useMemo } from "react";
import type { OportunidadesFiltros } from "@/features/crm/components/oportunidadesFiltersTypes";
import type { CrmOportunidadRow } from "@/features/crm/hooks/useOportunidades";
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

export function useOportunidadesFiltradas(
  opsRaw: CrmOportunidadRow[],
  filtros: OportunidadesFiltros,
) {
  return useMemo(() => {
    return opsRaw.filter((o) => {
      if (filtros.etapaId !== "todas" && o.etapa_id !== filtros.etapaId) return false;
      if (filtros.vendedorId !== "todos" && o.vendedor_id !== filtros.vendedorId) return false;
      if (filtros.cierreDesde && (!o.fecha_estimada_cierre || o.fecha_estimada_cierre < filtros.cierreDesde)) return false;
      if (filtros.cierreHasta && (!o.fecha_estimada_cierre || o.fecha_estimada_cierre > filtros.cierreHasta)) return false;
      if (filtros.montoMin) {
        const min = Number(filtros.montoMin);
        if (Number.isFinite(min) && Number(o.monto_estimado ?? 0) < min) return false;
      }
      return true;
    });
  }, [opsRaw, filtros]);
}
