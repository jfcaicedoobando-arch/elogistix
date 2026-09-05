import { AlertTriangle } from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import {
  statusColumn, clientColumn, dateColumn,
} from "@/components/shared/dataTable/columnBuilders";
import { calcularEstadoEmbarque } from "@/features/embarques/hooks";
import type { EmbarqueRow } from "@/features/embarques/hooks";
import { getOrigen, getDestino, shortName, PLACEHOLDER_VACIO } from "@/lib/formatters";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { sortByNumber } from "@/components/shared/dataTable/sortingFns";
import { expedienteConsecutivo } from "@/features/embarques/domain/embarquesPageHelpers";
import { ContenedorCell, type ContenedorInfo } from "@/features/embarques/components/ContenedorCell";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { Hint } from "@/components/shared/Hint";
import { labelExpediente } from "@/lib/domain/labelExpediente";

export type { ContenedorInfo };
export interface DocsInfo { pendientes: number; total: number }

export interface BuildColumnsParams {
  docsMap: Record<string, DocsInfo>;
  contenedoresPorExpediente?: Record<string, number>;
  /**
   * Map por embarque_id con info real de `embarque_contenedores`
   * (Fase 3 v12.12.0). Cuando existe, tiene prioridad sobre el legacy.
   * `incompletos` (v12.14.1): contenedores hijos sin número o tipo capturado.
   */
  contenedoresInfoMap?: Record<string, ContenedorInfo>;
}

/**
 * Columnas nativas TanStack (`ColumnDef<EmbarqueRow>`) usadas por
 * `Embarques.tsx` con `sortMode="server"`: `enableSorting` actúa sólo como
 * flag visual (cursor + icono); el orden real lo resuelve el RPC
 * `embarques_listado` vía `controlledSort`/`onSortChange`.
 *
 * Columnas de estado, cliente, etd y eta usan los builders de Oleada 1.
 * Las columnas de dominio específico (BL Master, contenedor, modo,
 * origen/destino) permanecen como columnas nativas.
 */
export function buildEmbarqueColumns({
  docsMap, contenedoresPorExpediente = {}, contenedoresInfoMap = {},
}: BuildColumnsParams): ColumnDef<EmbarqueRow, unknown>[] {
  return defineColumns<EmbarqueRow>([
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (e) => e.expediente,
      enableSorting: true,
      sortingFn: sortByNumber<EmbarqueRow>((e) => expedienteConsecutivo(e.expediente)),
      meta: { width: COL_W.monto, className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => {
        const e = row.original;
        const docInfo = docsMap[e.id];
        const hayPendientes = docInfo && docInfo.pendientes > 0;
        return (
          <span className="flex items-center gap-1">
            {labelExpediente(e.expediente, e.id)}
            {hayPendientes && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-body-sm">{docInfo.pendientes} doc(s) pendientes</p>
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
      // Oculto en tableta (<xl) — el detalle del embarque muestra el BL.
      meta: { width: COL_W.folio, className: "text-body-sm hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      // VB-30: placeholder vacío unificado (em dash), como el detalle.
      cell: ({ row }) => row.original.bl_master || PLACEHOLDER_VACIO,
    },
    {
      id: "contenedor",
      header: "Contenedores",
      meta: { width: COL_W.ruta, className: "text-body-sm font-mono" },
      cell: ({ row }) => (
        <ContenedorCell
          embarque={row.original}
          info={contenedoresInfoMap[row.original.id]}
          legacyCount={contenedoresPorExpediente[row.original.expediente ?? ""]}
        />
      ),
    },
    // — Builder: clientColumn —
    clientColumn<EmbarqueRow>({
      accessor: (e) => e.cliente_nombre,
      ...(({ meta: { width: COL_W.texto, className: "max-w-[240px] truncate" } }) as object),
    }),
    {
      id: "modo",
      header: "Modo",
      // En tableta (<xl) se oculta para dejar más ancho a Cliente/Estado.
      meta: { width: COL_W.short, className: "hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          <ModoIcon modo={row.original.modo} size={14} />
          <span className="text-body-sm">{row.original.modo}</span>
        </span>
      ),
    },
    {
      id: "origen",
      header: "Origen",
      meta: { width: COL_W.monto, className: "text-body-sm truncate hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => {
        const v = shortName(getOrigen(row.original));
        return <Hint label={v}><span className="block truncate">{v}</span></Hint>;
      },
    },
    {
      id: "destino",
      header: "Destino",
      meta: { width: COL_W.monto, className: "text-body-sm truncate hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => {
        const v = shortName(getDestino(row.original));
        return <Hint label={v}><span className="block truncate">{v}</span></Hint>;
      },
    },
    // — Builder: dateColumn ETD (oculto en <xl, mantenemos ETA como referencia principal) —
    {
      ...dateColumn<EmbarqueRow>({ id: "etd", header: "ETD", accessor: (e) => e.etd ?? null }),
      meta: { width: COL_W.fecha, className: "hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    // — Builder: dateColumn ETA —
    dateColumn<EmbarqueRow>({
      id: "eta",
      header: "ETA",
      accessor: (e) => e.eta ?? null,
    }),
    // — Builder: statusColumn (Oleada 1) —
    statusColumn<EmbarqueRow>({
      domain: "embarque",
      accessor: (e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado, e.fecha_llegada_real),
    }),
  ]);
}
