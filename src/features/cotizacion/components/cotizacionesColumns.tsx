/**
 * Columnas de la tabla Cotizaciones — Oleada 1 migration.
 * Usa `columnBuilders` compartidos para cliente, subtotal, fecha y acciones.
 * La celda `estado_vigencia` mantiene lógica compuesta (vigencia + badges extra).
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type ColumnDef } from "@/components/shared/DataTable";
import type { CotizacionListItem } from "@/features/cotizacion/hooks";
import { renderEstadoVigencia } from "./columnsParts/estadoVigenciaCell";
import { formatFechaHora } from "@/lib/formatters";
import {
  clientColumn,
  moneyColumn,
  actionsColumn,
} from "@/components/shared/dataTable/columnBuilders";
import { Trash2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { normalizarSubtotalMxn } from "@/features/cotizacion/domain/ordenSubtotalMxn";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

export interface BuildParams {
  canEdit: boolean;
  onEliminar: (id: string) => void;
  onDuplicar?: (id: string) => void;
  /** TC USD→MXN vigente, usado sólo para ordenar el subtotal multimoneda. */
  usdMxn?: number | null;
}

export function buildCotizacionesColumns(params: BuildParams): ColumnDef<CotizacionListItem, unknown>[] {
  const cols: ColumnDef<CotizacionListItem, unknown>[] = [
    {
      id: "folio",
      header: "Folio",
      accessorFn: (r) => r.folio,
      enableSorting: true,
      meta: { width: COL_W.folio, className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => row.original.folio,
    },
    clientColumn<CotizacionListItem>({
      id: "cliente",
      accessor: (r) => r.cliente_nombre,
    }),
    {
      id: "tipo_doc",
      header: "Tipo",
      // Oculto en tableta (<xl) — información secundaria (Tarifario vs Transaccional).
      meta: { width: COL_W.fecha, className: "text-body-sm hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => {
        const esInfo = row.original.tipo_documento === "informativa";
        return (
          <Badge variant={esInfo ? "info" : "neutral"} size="sm">
            {esInfo ? "Tarifario" : "Transaccional"}
          </Badge>
        );
      },
    },
    {
      id: "modo",
      header: "Modo",
      // Oculto en tableta (<xl).
      meta: { width: COL_W.short, className: "text-body-sm whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.modo,
    },
    {
      id: "ruta",
      header: "Origen → Destino",
      // Oculto en tableta (<xl) — la ruta se ve en el detalle.
      // VF-15: el tope de 200px truncaba "Shanghái → Manzanillo" habiendo
      // ancho disponible; se amplía al peldaño canónico de ruta.
      meta: { width: COL_W.ruta, className: "text-body-sm max-w-[320px] hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => {
        const r = row.original;
        const ruta = `${r.origen || "-"} → ${r.destino || "-"}`;
        return (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <span className="block truncate whitespace-nowrap">{ruta}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-body-sm max-w-[320px] break-words">{ruta}</TooltipContent>
          </Tooltip>
        );
      },
    },
    moneyColumn<CotizacionListItem>({
      id: "subtotal",
      header: "Subtotal",
      accessor: (r) => r.subtotal,
      currencyAccessor: (r) => r.moneda,
      // FIX 10: ordenar por equivalente en MXN evita mezclar montos nominales
      // de MXN y USD; sin TC confiable el valor queda al final.
      normalizar: (r) => normalizarSubtotalMxn(r.subtotal, r.moneda, params.usdMxn),
      headerTooltip: "Ordenado por equivalente en MXN",
    }),
    {
      id: "estado_vigencia",
      header: "Estado",
      accessorFn: (r) => r.estado,
      enableSorting: true,
      meta: { width: COL_W.ruta },
      // renderEstadoVigencia usa StatusBadge internamente (Oleada 1 migrado)
      cell: ({ row }) => renderEstadoVigencia(row.original),
    },
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (r) => r.created_at ?? "",
      enableSorting: true,
      // VF-04: `formatDate` (date-fns) usa la TZ del navegador/servidor y el
      // listado mostraba la hora del servidor. Se formatea con el formatter
      // canónico TZ_MX, igual que "Mi día" de CRM.
      cell: ({ row }) => (
        <span className="tabular-nums whitespace-nowrap">
          {row.original.created_at ? formatFechaHora(row.original.created_at) : "—"}
        </span>
      ),
      // Fecha oculta en tableta (<xl).
      meta: { width: COL_W.monto, className: "hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
  ];

  if (params.canEdit) {
    cols.push(
      actionsColumn<CotizacionListItem>({
        items: () => [
          ...(params.onDuplicar
            ? [
                {
                  label: "Duplicar",
                  icon: <Copy className="h-4 w-4" />,
                  onSelect: (row: CotizacionListItem) => params.onDuplicar?.(row.id),
                },
              ]
            : []),
          {
            label: "Eliminar",
            icon: <Trash2 className="h-4 w-4" />,
            variant: "destructive" as const,
            onSelect: (row: CotizacionListItem) => params.onEliminar(row.id),
          },
        ],
      }),
    );
  }


  return cols;
}
