/**
 * P1-B — Controlador de /compras/pagos.
 *
 * Filtros en la URL, consulta del listado global de pagos, métodos
 * disponibles, KPIs y exportación CSV. Sin JSX.
 */
import { useMemo } from "react";
import { useFiltroUrl, useTextoUrl } from "@/hooks/shared";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { useQuery } from "@tanstack/react-query";
import { compras } from "../queryKeys";
import { listarPagosProveedorGlobal } from "@/features/compras/services/pagosGlobal";
import { todayLocalISO } from "@/lib/date/today";
import { descargarBlob } from "@/lib/downloadBlob";
import { toCSV } from "@/lib/io/csv";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";

export const MONEDAS_FILTRO = ["todas", "MXN", "USD"] as const;
export type MonedaFiltro = (typeof MONEDAS_FILTRO)[number];

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function useComprasPagosController() {
  // M8 (Ola 8): filtros en la URL → el listado se puede compartir por link.
  const [desde, setDesde] = useTextoUrl("desde", firstOfMonth());
  const [hasta, setHasta] = useTextoUrl("hasta", todayLocalISO());
  const [moneda, setMoneda] = useFiltroUrl<MonedaFiltro>("moneda", MONEDAS_FILTRO, "todas");
  const [metodoPago, setMetodoPago] = useTextoUrl("metodo", "todos");
  const [search, setSearch] = useTextoUrl("q");
  const { organizationId, orgListo } = useOrgFilter();

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: compras.pagosGlobal({ desde, hasta, moneda, metodoPago, search }, organizationId),
    queryFn: () =>
      listarPagosProveedorGlobal(
        {
          desde,
          hasta,
          moneda: moneda === "todas" ? undefined : moneda,
          metodoPago: metodoPago === "todos" ? undefined : metodoPago,
          search: search.trim() || undefined,
        },
        organizationId,
      ),
    // N-3: no consultar hasta que el contexto de organización resolvió.
    enabled: orgListo,
  });

  const metodosDisponibles = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.metodo_pago && set.add(r.metodo_pago));
    return Array.from(set).sort();
  }, [rows]);

  const totalMxn = rows.filter((r) => r.moneda === "MXN").reduce((a, r) => a + r.monto, 0);
  const totalUsd = rows.filter((r) => r.moneda === "USD").reduce((a, r) => a + r.monto, 0);

  const handleExport = () => {
    try {
      const csv = toCSV(
        rows.map((r) => ({
          fecha: r.fecha_pago,
          proveedor: r.proveedor_nombre ?? "",
          folio_interno: r.factura_folio_interno ?? "",
          folio_proveedor: r.factura_folio_proveedor ?? "",
          metodo: r.metodo_pago,
          referencia: r.referencia ?? "",
          moneda: r.moneda,
          monto: r.monto,
          tipo_cambio_usd: r.tipo_cambio_usd ?? "",
        })),
      );
      descargarBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `pagos-proveedor-${desde}-${hasta}.csv`,
      );
      notifySuccess(undefined, {
        title: "CSV descargado",
        description: `${rows.length} pagos exportados.`,
      });
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo exportar el CSV",
        error: e,
        method: "EXPORT_PAGOS_CSV",
      });
    }
  };

  return {
    desde, setDesde, hasta, setHasta,
    moneda, setMoneda, metodoPago, setMetodoPago, search, setSearch,
    rows, isLoading, isError, refetch,
    metodosDisponibles, totalMxn, totalUsd,
    handleExport,
  };
}
