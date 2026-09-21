/**
 * P1-B — Controlador de /compras/conciliacion.
 *
 * Filtros en la URL, consulta de cobertura factura ↔ embarque, KPIs y estado
 * del panel de detalle. Sin JSX.
 */
import { useMemo, useState } from "react";
import { useFiltroUrl, useTextoUrl } from "@/hooks/shared";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { useQuery } from "@tanstack/react-query";
import { compras } from "../queryKeys";
import {
  listarConciliacionEmbarques,
  type EmbarqueConciliacion,
  type EstadoConciliacion,
} from "@/features/compras/services/conciliacionEmbarques";

export const ESTADOS_FILTRO = ["todos", "sin_facturar", "parcial", "completa"] as const;
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number] & (EstadoConciliacion | "todos");
export const MONEDAS_FILTRO = ["todas", "MXN", "USD", "EUR"] as const;
export type MonedaFiltro = (typeof MONEDAS_FILTRO)[number];

export function useComprasConciliacionController() {
  // M8 (Ola 8): filtros en la URL → el listado se puede compartir por link.
  const [estado, setEstado] = useFiltroUrl<EstadoFiltro>("estado", ESTADOS_FILTRO, "todos");
  const [moneda, setMoneda] = useFiltroUrl<MonedaFiltro>("moneda", MONEDAS_FILTRO, "todas");
  const [search, setSearch] = useTextoUrl("q");
  const [detalle, setDetalle] = useState<EmbarqueConciliacion | null>(null);
  const { organizationId, orgListo } = useOrgFilter();

  const { data: rows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: compras.conciliacionEmbarques({ estado, moneda, search }, organizationId),
    queryFn: () =>
      listarConciliacionEmbarques({
        estado: estado === "todos" ? "todos" : estado,
        moneda: moneda === "todas" ? undefined : moneda,
        search: search.trim() || undefined,
        organizationId,
      }),
    // N-3: no consultar hasta que el contexto de organización resolvió.
    enabled: orgListo,
    staleTime: 30_000,
  });

  const kpis = useMemo(() => {
    const sinFacturar = rows.filter((r) => r.estado_conciliacion === "sin_facturar").length;
    const parcial = rows.filter((r) => r.estado_conciliacion === "parcial").length;
    const completa = rows.filter((r) => r.estado_conciliacion === "completa").length;
    const pendienteMxn = rows.filter((r) => r.moneda === "MXN").reduce((a, r) => a + r.pendiente, 0);
    const pendienteUsd = rows.filter((r) => r.moneda === "USD").reduce((a, r) => a + r.pendiente, 0);
    const pendienteEur = rows.filter((r) => r.moneda === "EUR").reduce((a, r) => a + r.pendiente, 0);
    return { sinFacturar, parcial, completa, pendienteMxn, pendienteUsd, pendienteEur };
  }, [rows]);

  return {
    estado, setEstado, moneda, setMoneda, search, setSearch,
    detalle, setDetalle,
    rows, isLoading, isError, error, refetch,
    kpis,
  };
}
