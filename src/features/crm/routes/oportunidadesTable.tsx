import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import {
  moneyColumn,
  dateColumn,
} from "@/components/shared/dataTable/columnBuilders";
import type { CrmOportunidadRow } from "@/features/crm/hooks";
import type { OportunidadesFiltros } from "@/features/crm/components/oportunidadesFiltersTypes";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import type { ProximaActividad } from "@/features/crm/hooks/useProximasActividades";
import { formatFechaEs } from "@/lib/formatters/dates";

/** Celda truncada con el texto completo accesible vía title/aria-label. */
function celdaTruncada(texto: string) {
  return (
    <span className="block truncate" title={texto} aria-label={texto}>
      {texto}
    </span>
  );
}

// v13.823.78 — anchos y breakpoints ajustados: en desktop HD (1280x720) la
// tabla desbordaba (~1161px de contenido en ~950px útiles) y "Siguiente
// actividad" quedaba fuera de vista. Ahora "Oportunidad" es la columna
// flexible y Prob/Vendedor aparecen desde 2xl.
export const oportunidadesColumns: ColumnDef<CrmOportunidadRow, unknown>[] = defineColumns<CrmOportunidadRow>([
  {
    id: "nombre",
    header: "Oportunidad",
    meta: { className: "font-medium", sticky: true },
    cell: ({ row }) => celdaTruncada(row.original.nombre),
  },
  {
    id: "cliente",
    header: "Cliente",
    meta: { width: COL_W.nombre, className: "text-body-sm" },
    cell: ({ row }) => celdaTruncada(row.original.cliente_nombre || "—"),
  },
  {
    ...moneyColumn<CrmOportunidadRow>({
      id: "monto",
      header: "Monto",
      accessor: (r) => Number(r.monto_estimado ?? 0),
      currencyAccessor: (r) => r.moneda,
    }),
    meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap text-xs" },
  },
  {
    id: "prob",
    header: "Prob",
    meta: { width: COL_W.tiny, align: "center", className: "text-center text-xs hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
    cell: ({ row }) => `${row.original.probabilidad}%`,
  },
  {
    ...dateColumn<CrmOportunidadRow>({
      id: "fecha",
      header: "Cierre est.",
      accessor: (r) => r.fecha_estimada_cierre,
    }),
    meta: { width: COL_W.fecha, className: "text-xs whitespace-nowrap" },
  },
  {
    id: "vendedor",
    header: "Vendedor",
    meta: { width: COL_W.nombre, className: "text-xs hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
    cell: ({ row }) => celdaTruncada(row.original.vendedor_email || "—"),
  },
]);

/**
 * Columna "Siguiente actividad" (paridad con el CRM comercial en Excel):
 * muestra el asunto y la fecha del pendiente más próximo por oportunidad.
 */
export function siguienteActividadColumn(
  proximas: Map<string, ProximaActividad>,
): ColumnDef<CrmOportunidadRow, unknown> {
  return {
    id: "siguiente_actividad",
    header: "Siguiente actividad",
    meta: {
      width: COL_W.nombre,
      className: "text-xs hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    cell: ({ row }) => {
      const a = proximas.get(row.original.id);
      if (!a) return celdaTruncada("Sin actividad");
      const fecha = a.fecha_programada ? formatFechaEs(a.fecha_programada) : "sin fecha";
      return celdaTruncada(`${a.asunto} · ${fecha}`);
    },
  } as ColumnDef<CrmOportunidadRow, unknown>;
}

export function activosFiltros(f: OportunidadesFiltros): number {
  let n = 0;
  if (f.etapaId !== "todas") n++;
  if (f.vendedorId !== "todos") n++;
  if (f.cierreDesde) n++;
  if (f.cierreHasta) n++;
  if (f.montoMin) n++;
  return n;
}
