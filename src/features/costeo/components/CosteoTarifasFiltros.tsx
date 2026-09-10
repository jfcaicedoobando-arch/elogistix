/**
 * Barra de filtros de la matriz de tarifas marítimas.
 * v13.135.52: sin Card wrapper, búsqueda prominente, selects sm.
 */
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LayoutList, Rows3, Search, X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { EstadoFiltro, AprobacionFiltro } from "../routes/CosteoTarifas.helpers";
import type { ViewMode } from "../routes/useCosteoTarifasPageState";

interface OpcionId { id: string; nombre?: string; name?: string }

interface Props {
  estado: EstadoFiltro;
  onEstadoChange: (v: EstadoFiltro) => void;
  aprobacion: AprobacionFiltro;
  onAprobacionChange: (v: AprobacionFiltro) => void;
  agenteId: string;
  onAgenteChange: (v: string) => void;
  tipoId: string;
  onTipoChange: (v: string) => void;
  busqueda: string;
  onBusquedaChange: (v: string) => void;
  agentes: OpcionId[];
  tipos: OpcionId[];
  pendientesCount: number;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  total: number;
  viewMode: ViewMode;
  onViewModeChange: (view: ViewMode) => void;
}

export function CosteoTarifasFiltros({
  estado, onEstadoChange,
  aprobacion, onAprobacionChange,
  agenteId, onAgenteChange, tipoId, onTipoChange,
  busqueda, onBusquedaChange,
  agentes, tipos, pendientesCount, onClearAll, hasActiveFilters,
  total, viewMode, onViewModeChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-y py-3 short:py-2">
      <div className="relative flex-1 min-w-[260px] max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          id="filtro-buscar"
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
          placeholder="Buscar por puerto, agente o naviera…"
          className="pl-9 pr-8 h-9"
          aria-label="Buscar tarifas"
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => onBusquedaChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <Select value={aprobacion} onValueChange={(v) => onAprobacionChange(v as AprobacionFiltro)}>
        <SelectTrigger className="h-9 w-auto gap-1.5" aria-label="Filtrar por aprobación">
          <span className="text-body-sm text-muted-foreground">Aprobación:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas</SelectItem>
          <SelectItem value="borrador">Pendientes{pendientesCount > 0 ? ` (${pendientesCount})` : ""}</SelectItem>
          <SelectItem value="vigente">Aprobadas</SelectItem>
          <SelectItem value="rechazada">Rechazadas</SelectItem>
        </SelectContent>
      </Select>

      <Select value={estado} onValueChange={(v) => onEstadoChange(v as EstadoFiltro)}>
        <SelectTrigger className="h-9 w-auto gap-1.5" aria-label="Filtrar por vigencia">
          <span className="text-body-sm text-muted-foreground">Vigencia:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas</SelectItem>
          <SelectItem value="vigente">Vigentes</SelectItem>
          <SelectItem value="vencida">Vencidas</SelectItem>
          <SelectItem value="reemplazada">Reemplazadas</SelectItem>
        </SelectContent>
      </Select>

      <Select value={agenteId} onValueChange={onAgenteChange}>
        <SelectTrigger className="h-9 w-auto gap-1.5" aria-label="Filtrar por agente">
          <span className="text-body-sm text-muted-foreground">Agente:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {agentes.map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.nombre ?? a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={tipoId} onValueChange={onTipoChange}>
        <SelectTrigger className="h-9 w-auto gap-1.5" aria-label="Filtrar por contenedor">
          <span className="text-body-sm text-muted-foreground">Contenedor:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {tipos.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name ?? t.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearAll} className="h-9 text-body-sm">
          <X className="size-4 mr-1" />Limpiar filtros
        </Button>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span className="whitespace-nowrap text-body-sm text-muted-foreground tabular-nums">
          {total} {total === 1 ? "tarifa" : "tarifas"}
        </span>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && onViewModeChange(value as ViewMode)}
          aria-label="Modo de vista"
        >
          <ToggleGroupItem value="agrupada" aria-label="Vista agrupada por ruta" className="h-8 px-3 text-body-sm">
            <Rows3 className="mr-1 size-4" />Agrupada
          </ToggleGroupItem>
          <ToggleGroupItem value="tabla" aria-label="Vista tabla plana" className="h-8 px-3 text-body-sm">
            <LayoutList className="mr-1 size-4" />Tabla
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
