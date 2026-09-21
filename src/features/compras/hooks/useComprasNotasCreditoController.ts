/**
 * P1-B — Controlador de /compras/notas-credito.
 *
 * Filtros en la URL, consulta del listado global, KPIs y exportación CSV.
 * Sin JSX: la página sólo renderiza.
 */
import { useFiltroUrl, useTextoUrl } from "@/hooks/shared";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { useQuery } from "@tanstack/react-query";
import { compras } from "../queryKeys";
import {
  listarNotasCreditoGlobal,
  type NotaCreditoRow,
} from "@/features/compras/services/notasCreditoGlobal";
import { todayLocalISO } from "@/lib/date/today";
import { descargarBlob } from "@/lib/downloadBlob";
import { toCSV } from "@/lib/io/csv";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";

export const MONEDAS_FILTRO = ["todas", "MXN", "USD"] as const;
export type MonedaFiltro = (typeof MONEDAS_FILTRO)[number];
export const ESTADOS_FILTRO = ["todos", "Borrador", "Aprobada", "Aplicada", "Cancelada"] as const;
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number] & ("todos" | NotaCreditoRow["estado"]);

function firstOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function useComprasNotasCreditoController() {
  // M8 (Ola 8): filtros en la URL → el listado se puede compartir por link.
  const [desde, setDesde] = useTextoUrl("desde", firstOfYear());
  const [hasta, setHasta] = useTextoUrl("hasta", todayLocalISO());
  const [moneda, setMoneda] = useFiltroUrl<MonedaFiltro>("moneda", MONEDAS_FILTRO, "todas");
  const [estado, setEstado] = useFiltroUrl<EstadoFiltro>("estado", ESTADOS_FILTRO, "todos");
  const [search, setSearch] = useTextoUrl("q");
  const { organizationId, orgListo } = useOrgFilter();

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: compras.notasCreditoGlobal({ desde, hasta, moneda, estado, search }, organizationId),
    queryFn: () =>
      listarNotasCreditoGlobal(
        {
          desde,
          hasta,
          moneda: moneda === "todas" ? undefined : moneda,
          estado: estado === "todos" ? undefined : estado,
          search: search.trim() || undefined,
        },
        organizationId,
      ),
    // N-3: no consultar hasta que el contexto de organización resolvió.
    enabled: orgListo,
  });

  const totalMxn = rows
    .filter((r) => r.moneda === "MXN" && r.estado === "Aplicada")
    .reduce((a, r) => a + r.monto, 0);
  const totalUsd = rows
    .filter((r) => r.moneda === "USD" && r.estado === "Aplicada")
    .reduce((a, r) => a + r.monto, 0);

  const handleExport = () => {
    try {
      const csv = toCSV(
        rows.map((r) => ({
          fecha: r.fecha,
          folio_nc: r.folio_nc ?? "",
          proveedor: r.proveedor_nombre ?? "",
          factura: r.factura_folio_interno ?? "",
          folio_proveedor: r.factura_folio_proveedor ?? "",
          motivo: r.motivo,
          estado: r.estado,
          moneda: r.moneda,
          monto: r.monto,
          descripcion: r.descripcion ?? "",
        })),
      );
      descargarBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `notas-credito-proveedor-${desde}-${hasta}.csv`,
      );
      notifySuccess(undefined, {
        title: "CSV descargado",
        description: `${rows.length} notas de crédito exportadas.`,
      });
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo exportar el CSV",
        error: e,
        method: "EXPORT_NC_CSV",
      });
    }
  };

  return {
    desde, setDesde, hasta, setHasta,
    moneda, setMoneda, estado, setEstado, search, setSearch,
    rows, isLoading, isError, refetch,
    totalMxn, totalUsd,
    handleExport,
  };
}
