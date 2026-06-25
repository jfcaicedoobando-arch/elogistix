/**
 * Chips removibles para filtros activos de tarifas marítimas.
 * v13.135.48
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { EstadoFiltro, AprobacionFiltro } from "../routes/CosteoTarifas.helpers";

interface OpcionId { id: string; nombre?: string; name?: string }

interface Props {
  estado: EstadoFiltro;
  aprobacion: AprobacionFiltro;
  agenteId: string;
  tipoId: string;
  busqueda: string;
  agentes: OpcionId[];
  tipos: OpcionId[];
  onClearEstado: () => void;
  onClearAprobacion: () => void;
  onClearAgente: () => void;
  onClearTipo: () => void;
  onClearBusqueda: () => void;
  onClearAll: () => void;
}

const aprobLabels: Record<AprobacionFiltro, string> = {
  borrador: "Pendientes",
  vigente: "Aprobadas",
  rechazada: "Rechazadas",
  todas: "Todas",
};

const estadoLabels: Record<EstadoFiltro, string> = {
  vigente: "Vigentes",
  vencida: "Vencidas",
  reemplazada: "Reemplazadas",
  todas: "Todas",
};

interface ChipProps { label: string; onRemove: () => void }

function Chip({ label, onRemove }: ChipProps) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1 py-1">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

export function TarifasFilterChips(props: Props) {
  const chips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (props.aprobacion !== "todas") {
    chips.push({ key: "ap", label: aprobLabels[props.aprobacion], remove: props.onClearAprobacion });
  }
  if (props.estado !== "todas") {
    chips.push({ key: "es", label: estadoLabels[props.estado], remove: props.onClearEstado });
  }
  if (props.agenteId !== "todos") {
    const a = props.agentes.find((x) => x.id === props.agenteId);
    chips.push({ key: "ag", label: `Agente: ${a?.nombre ?? a?.name ?? "—"}`, remove: props.onClearAgente });
  }
  if (props.tipoId !== "todos") {
    const t = props.tipos.find((x) => x.id === props.tipoId);
    chips.push({ key: "tp", label: `Cont.: ${t?.name ?? t?.nombre ?? "—"}`, remove: props.onClearTipo });
  }
  if (props.busqueda.trim() !== "") {
    chips.push({ key: "bq", label: `“${props.busqueda.trim()}”`, remove: props.onClearBusqueda });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Filtros activos:</span>
      {chips.map((c) => (
        <Chip key={c.key} label={c.label} onRemove={c.remove} />
      ))}
      <Button variant="ghost" size="sm" onClick={props.onClearAll} className="h-7 text-xs">
        Limpiar todo
      </Button>
    </div>
  );
}
