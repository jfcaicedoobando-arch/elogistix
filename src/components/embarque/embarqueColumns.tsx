/* eslint-disable react-refresh/only-export-components -- archivo de definición de columnas: mezcla helpers de UI + builder; HMR aceptable. */
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { calcularEstadoEmbarque } from "@/hooks/embarque";
import type { EmbarqueRow } from "@/hooks/embarque";
import { formatDate, getOrigen, getDestino, shortName, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { sortByString, sortByDate } from "@/components/shared/dataTable/sortingFns";

export interface DocsInfo { pendientes: number; total: number }

export interface BuildColumnsParams {
  docsMap: Record<string, DocsInfo>;
  contenedoresPorExpediente?: Record<string, number>;
}

/**
 * Columnas nativas TanStack (`ColumnDef<EmbarqueRow>`). Fase 2 del refactor —
 * fueron migradas desde la API legacy `DataTableColumn<T>` (ver Fase 1 en
 * `columnAdapter.ts`). En `Embarques.tsx` se usan con `sortMode="server"`,
 * por eso `enableSorting` actúa sólo como flag visual: el orden real lo
 * resuelve el RPC `embarques_listado` vía `controlledSort`/`onSortChange`.
 */
export function buildEmbarqueColumns({
  docsMap, contenedoresPorExpediente = {},
}: BuildColumnsParams): ColumnDef<EmbarqueRow, unknown>[] {
  return defineColumns<EmbarqueRow>([
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (e) => e.expediente,
      enableSorting: true,
      sortingFn: sortByString<EmbarqueRow>((e) => e.expediente),
      meta: { width: "w-[130px]", className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => {
        const e = row.original;
        const docInfo = docsMap[e.id];
        const hayPendientes = docInfo && docInfo.pendientes > 0;
        return (
          <span className="flex items-center gap-1">
            {e.expediente}
            {hayPendientes && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{docInfo.pendientes} doc(s) pendientes</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </span>
        );
      },
    },
    {
      id: "bl",
      header: "BL Master",
      meta: { width: "w-[120px]", className: "text-xs" },
      cell: ({ row }) => row.original.bl_master || "-",
    },
    {
      id: "contenedor",
      header: "Contenedores",
      meta: { width: "w-[140px]", className: "text-xs font-mono" },
      cell: ({ row }) => {
        const e = row.original;
        const count = contenedoresPorExpediente[e.expediente] ?? 1;
        if (count > 1) {
          return (
            <span className="inline-flex items-center gap-1.5">
              <span className="truncate max-w-[80px]" title={e.contenedor || ""}>{e.contenedor || "-"}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4" title={`${count} contenedores agrupados`}>+{count - 1}</Badge>
            </span>
          );
        }
        return e.contenedor || <span className="text-muted-foreground">-</span>;
      },
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (e) => e.cliente_nombre,
      enableSorting: true,
      sortingFn: sortByString<EmbarqueRow>((e) => e.cliente_nombre),
      meta: { width: "min-w-[140px]", className: "max-w-[160px] truncate" },
      cell: ({ row }) => {
        const nombre = toTitleCase(row.original.cliente_nombre);
        return <span title={nombre} className="block truncate">{nombre}</span>;
      },
    },
    {
      id: "modo",
      header: "Modo",
      meta: { width: "w-[90px]" },
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          <ModoIcon modo={row.original.modo} size={14} /> <span className="text-xs">{row.original.modo}</span>
        </span>
      ),
    },
    {
      id: "origen",
      header: "Origen",
      meta: { width: "w-[120px]", className: "text-xs" },
      cell: ({ row }) => shortName(getOrigen(row.original)),
    },
    {
      id: "destino",
      header: "Destino",
      meta: { width: "w-[120px]", className: "text-xs" },
      cell: ({ row }) => shortName(getDestino(row.original)),
    },
    {
      id: "etd",
      header: "ETD",
      accessorFn: (e) => e.etd ?? "",
      enableSorting: true,
      sortingFn: sortByDate<EmbarqueRow>((e) => e.etd),
      meta: { width: "w-[90px]", className: "text-xs" },
      cell: ({ row }) => formatDate(row.original.etd || ""),
    },
    {
      id: "eta",
      header: "ETA",
      accessorFn: (e) => e.eta ?? "",
      enableSorting: true,
      sortingFn: sortByDate<EmbarqueRow>((e) => e.eta),
      meta: { width: "w-[90px]", className: "text-xs" },
      cell: ({ row }) => formatDate(row.original.eta || ""),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado),
      enableSorting: true,
      sortingFn: sortByString<EmbarqueRow>((e) =>
        calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado),
      ),
      meta: { width: "w-[110px]" },
      cell: ({ row }) => {
        const e = row.original;
        const estado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
        return <Badge variant="secondary" className={`text-xs whitespace-nowrap ${getEstadoColor(estado)}`}>{estado}</Badge>;
      },
    },
  ]);
}
