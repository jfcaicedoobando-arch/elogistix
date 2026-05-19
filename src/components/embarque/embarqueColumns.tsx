/* eslint-disable react-refresh/only-export-components -- archivo de definición de columnas: mezcla helpers de UI + builder; HMR aceptable. */
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import type { DataTableColumn } from "@/components/shared/DataTable";
import { calcularEstadoEmbarque } from "@/hooks/embarque";
import type { EmbarqueRow } from "@/hooks/embarque";
import { formatDate, getOrigen, getDestino, shortName, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { ModoIcon } from "@/components/shared/ModoIcon";
import EmbarqueRowActions from "./EmbarqueRowActions";
import { ProformaBadge } from "./ProformaBadge";

export interface DocsInfo { pendientes: number; total: number }

export interface BuildColumnsParams {
  canEdit: boolean;
  docsMap: Record<string, DocsInfo>;
  contenedoresPorExpediente?: Record<string, number>;
  onEditar: (e: EmbarqueRow) => void;
  onEliminar: (e: EmbarqueRow) => void;
}

export function buildEmbarqueColumns({
  canEdit, docsMap, contenedoresPorExpediente = {}, onEditar, onEliminar,
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
    { key: "contenedor", header: "Contenedores", width: "w-[140px]", className: "text-xs font-mono", render: (e) => {
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
    } },
    { key: "cliente", header: "Cliente", width: "min-w-[140px]", className: "max-w-[160px] truncate", sortable: true, sortValue: (e) => e.cliente_nombre, render: (e) => {
      const nombre = toTitleCase(e.cliente_nombre);
      return <span title={nombre} className="block truncate">{nombre}</span>;
    } },
    {
      key: "modo", header: "Modo", width: "w-[90px]", render: (e) => (
        <span className="flex items-center gap-1.5">
          <ModoIcon modo={e.modo} size={14} /> <span className="text-xs">{e.modo}</span>
        </span>
      ),
    },
    { key: "origen", header: "Origen", width: "w-[120px]", className: "text-xs", render: (e) => shortName(getOrigen(e)) },
    { key: "destino", header: "Destino", width: "w-[120px]", className: "text-xs", render: (e) => shortName(getDestino(e)) },
    { key: "etd", header: "ETD", width: "w-[90px]", className: "text-xs", sortable: true, sortValue: (e) => e.etd || "", render: (e) => formatDate(e.etd || "") },
    { key: "eta", header: "ETA", width: "w-[90px]", className: "text-xs", sortable: true, sortValue: (e) => e.eta || "", render: (e) => formatDate(e.eta || "") },
    {
      key: "estado", header: "Estado", width: "w-[110px]", sortable: true,
      sortValue: (e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado),
      render: (e) => {
        const estado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
        return <Badge variant="secondary" className={`text-xs whitespace-nowrap ${getEstadoColor(estado)}`}>{estado}</Badge>;
      },
    },
    {
      key: "proforma", header: "Proforma", width: "w-[180px]",
      render: (e) => <ProformaBadge tieneProforma={e.tiene_proforma} size="sm" />,
    },
  ];

  if (canEdit) {
    base.push({
      key: "acciones",
      header: "",
      width: "w-12",
      className: "w-12",
      stickyRight: true,
      render: (e) => (
        <EmbarqueRowActions
          embarque={e}
          onEditar={onEditar}
          onEliminar={onEliminar}
        />
      ),

    });
  }

  return base;
}
