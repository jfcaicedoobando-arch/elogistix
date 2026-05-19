/**
 * Definición de columnas para la tabla de Cotizaciones (Fase 2 — ColumnDef
 * nativo TanStack). En `Cotizaciones.tsx` se usa con `sortMode="server"`,
 * por lo que `enableSorting` actúa como flag visual y el orden real lo
 * resuelve el RPC.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type ColumnDef } from "@/components/shared/DataTable";
import { formatDate, formatCurrency, toTitleCase } from "@/lib/formatters";
import type { CotizacionListItem } from "@/hooks/cotizacion";
import { renderEstadoVigencia } from "./columnsParts/estadoVigenciaCell";
import { renderAcciones, type AccionesParams } from "./columnsParts/accionesCell";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";

interface BuildParams extends AccionesParams {
  canEdit: boolean;
}

export function buildCotizacionesColumns(params: BuildParams): ColumnDef<CotizacionListItem, unknown>[] {
  const cols: ColumnDef<CotizacionListItem, unknown>[] = [
    {
      id: "folio",
      header: "Folio",
      accessorFn: (r) => r.folio,
      enableSorting: true,
      sortingFn: sortByString<CotizacionListItem>((r) => r.folio),
      meta: { width: "w-[120px]", className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => row.original.folio,
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (r) => r.cliente_nombre,
      enableSorting: true,
      sortingFn: sortByString<CotizacionListItem>((r) => r.cliente_nombre),
      meta: { width: "min-w-[160px]", className: "max-w-[180px] truncate" },
      cell: ({ row }) => {
        const nombre = toTitleCase(row.original.cliente_nombre);
        return <span title={nombre} className="block truncate">{nombre}</span>;
      },
    },
    {
      id: "modo",
      header: "Modo",
      meta: { width: "w-[80px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => row.original.modo,
    },
    {
      id: "ruta",
      header: "Origen → Destino",
      meta: { width: "min-w-[160px]", className: "text-xs max-w-[200px]" },
      cell: ({ row }) => {
        const r = row.original;
        const ruta = `${r.origen || "-"} → ${r.destino || "-"}`;
        return (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <span className="block truncate whitespace-nowrap">{ruta}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[320px] break-words">{ruta}</TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "subtotal",
      header: "Subtotal",
      accessorFn: (r) => r.subtotal,
      enableSorting: true,
      sortingFn: sortByNumber<CotizacionListItem>((r) => r.subtotal),
      meta: { width: "w-[110px]", align: "right", className: "text-xs whitespace-nowrap tabular-nums" },
      cell: ({ row }) => formatCurrency(row.original.subtotal, row.original.moneda),
    },
    {
      id: "estado_vigencia",
      header: "Estado",
      accessorFn: (r) => r.estado,
      enableSorting: true,
      sortingFn: sortByString<CotizacionListItem>((r) => r.estado),
      meta: { width: "w-[180px]" },
      cell: ({ row }) => renderEstadoVigencia(row.original),
    },
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (r) => r.created_at,
      enableSorting: true,
      sortingFn: sortByDate<CotizacionListItem>((r) => r.created_at),
      meta: { width: "w-[130px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.created_at, "dd/MM/yyyy HH:mm"),
    },
  ];

  if (params.canEdit) {
    cols.push({
      id: "acciones",
      header: "",
      meta: { headerClassName: "w-[60px]" },
      cell: ({ row }) =>
        renderAcciones(row.original, {
          onEditar: params.onEditar,
          onEliminar: params.onEliminar,
        }),
    });
  }

  return cols;
}
