/**
 * Columnas de la tabla Cotizaciones — Oleada 1 migration.
 * Usa `columnBuilders` compartidos para cliente, subtotal, fecha y acciones.
 * La celda `estado_vigencia` mantiene lógica compuesta (vigencia + badges extra).
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type ColumnDef } from "@/components/shared/DataTable";
import type { CotizacionListItem } from "@/features/cotizacion/hooks";
import { renderEstadoVigencia } from "./columnsParts/estadoVigenciaCell";
import {
  clientColumn,
  moneyColumn,
  dateColumn,
  actionsColumn,
} from "@/components/shared/dataTable/columnBuilders";
import { Trash2, Copy } from "lucide-react";
import { normalizarSubtotalMxn } from "@/features/cotizacion/domain/ordenSubtotalMxn";

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
      meta: { width: "w-[120px]", className: "font-medium whitespace-nowrap", sticky: true },
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
      meta: { width: "w-[100px]", className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => {
        const esInfo = row.original.tipo_documento === "informativa";
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ${esInfo ? "bg-info/15 text-info" : "bg-muted text-muted-foreground"}`}>
            {esInfo ? "Tarifario" : "Transaccional"}
          </span>
        );
      },
    },
    {
      id: "modo",
      header: "Modo",
      // Oculto en tableta (<xl).
      meta: { width: "w-[80px]", className: "text-xs whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.modo,
    },
    {
      id: "ruta",
      header: "Origen → Destino",
      // Oculto en tableta (<xl) — la ruta se ve en el detalle.
      meta: { width: "min-w-[160px]", className: "text-xs max-w-[200px] hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
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
      meta: { width: "w-[180px]" },
      // renderEstadoVigencia usa StatusBadge internamente (Oleada 1 migrado)
      cell: ({ row }) => renderEstadoVigencia(row.original),
    },
    {
      ...dateColumn<CotizacionListItem>({
        id: "fecha",
        header: "Fecha",
        accessor: (r) => r.created_at,
        format: "dd/MM/yyyy HH:mm",
      }),
      // Fecha oculta en tableta (<xl).
      meta: { width: "w-[130px]", className: "hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
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
