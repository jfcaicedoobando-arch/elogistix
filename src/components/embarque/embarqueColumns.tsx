import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import type { DataTableColumn } from "@/components/shared/DataTable";
import { calcularEstadoEmbarque } from "@/hooks/embarque/useEmbarques";
import type { EmbarqueRow } from "@/hooks/embarque/useEmbarques";
import { formatDate, getOrigen, getDestino, shortName } from "@/lib/formatters";
import { getEstadoColor, getModoIcon } from "@/lib/ui/uiMappings";
import EmbarqueRowActions from "./EmbarqueRowActions";
import { ProformaBadge } from "./ProformaBadge";

export interface DocsInfo { pendientes: number; total: number }
export interface LiquidacionInfo { pagados: number; total: number }

export interface BuildColumnsParams {
  canEdit: boolean;
  docsMap: Record<string, DocsInfo>;
  liquidacionMap: Record<string, LiquidacionInfo>;
  onEditar: (e: EmbarqueRow) => void;
  onDuplicar: (e: EmbarqueRow) => void;
  onEliminar: (e: EmbarqueRow) => void;
}

function LiquidacionBadge({ info }: { info?: LiquidacionInfo }) {
  if (!info || info.total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  if (info.pagados === info.total) {
    return <Badge variant="success" className="text-xs">Pagado</Badge>;
  }
  if (info.pagados > 0) {
    return <Badge variant="warning" className="text-xs">Parcial</Badge>;
  }
  return <Badge variant="destructive" className="text-xs">Pendiente</Badge>;
}

export function buildEmbarqueColumns({
  canEdit, docsMap, liquidacionMap, onEditar, onDuplicar, onEliminar,
}: BuildColumnsParams): DataTableColumn<EmbarqueRow>[] {
  const base: DataTableColumn<EmbarqueRow>[] = [
    {
      key: "expediente", header: "Expediente", width: "w-[130px]", className: "font-medium whitespace-nowrap",
      sticky: true, sortable: true, sortValue: (e) => e.expediente,
      render: (e) => {
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
    { key: "bl", header: "BL Master", width: "w-[120px]", className: "text-xs", render: (e) => e.bl_master || "-" },
    { key: "contenedor", header: "Contenedor", width: "w-[130px]", className: "text-xs font-mono", render: (e) => e.contenedor || <span className="text-muted-foreground">-</span> },
    { key: "cliente", header: "Cliente", width: "min-w-[160px]", className: "max-w-[180px] truncate", sortable: true, sortValue: (e) => e.cliente_nombre, render: (e) => e.cliente_nombre },
    {
      key: "modo", header: "Modo", width: "w-[90px]", render: (e) => (
        <span className="flex items-center gap-1">
          {getModoIcon(e.modo)} <span className="text-xs">{e.modo}</span>
        </span>
      ),
    },
    { key: "origen", header: "Origen", width: "w-[120px]", className: "text-xs", render: (e) => shortName(getOrigen(e)) },
    { key: "destino", header: "Destino", width: "w-[120px]", className: "text-xs", render: (e) => shortName(getDestino(e)) },
    { key: "etd", header: "ETD", width: "w-[90px]", className: "text-xs", sortable: true, sortValue: (e) => e.etd || "", render: (e) => formatDate(e.etd || "") },
    { key: "eta", header: "ETA", width: "w-[90px]", className: "text-xs", sortable: true, sortValue: (e) => e.eta || "", render: (e) => formatDate(e.eta || "") },
    {
      key: "estado", header: "Estado", width: "w-[120px]", sortable: true,
      sortValue: (e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado),
      render: (e) => {
        const estado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
        return <Badge variant="secondary" className={`text-xs whitespace-nowrap ${getEstadoColor(estado)}`}>{estado}</Badge>;
      },
    },
    {
      key: "liquidacion", header: "Costos", width: "w-[90px]",
      render: (e) => <LiquidacionBadge info={liquidacionMap[e.id]} />,
    },
    {
      key: "proforma", header: "Proforma", width: "w-[180px]",
      sortable: true,
      sortValue: (e) => (e.tiene_proforma ? "1" : "0"),
      render: (e) => <ProformaBadge tieneProforma={e.tiene_proforma} size="sm" />,
    },
  ];

  if (canEdit) {
    base.push({
      key: "acciones",
      header: "",
      className: "w-10",
      render: (e) => (
        <EmbarqueRowActions
          embarque={e}
          onEditar={onEditar}
          onDuplicar={onDuplicar}
          onEliminar={onEliminar}
        />
      ),
    });
  }

  return base;
}
