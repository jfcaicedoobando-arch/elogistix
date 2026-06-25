/**
 * Filtros de la matriz de tarifas marítimas.
 * v13.135.48: agrega búsqueda y botón limpiar.
 */
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import type { EstadoFiltro, AprobacionFiltro } from "../routes/CosteoTarifas.helpers";

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
}

export function CosteoTarifasFiltros({
  estado, onEstadoChange,
  aprobacion, onAprobacionChange,
  agenteId, onAgenteChange, tipoId, onTipoChange,
  busqueda, onBusquedaChange,
  agentes, tipos, pendientesCount, onClearAll, hasActiveFilters,
}: Props) {
  return (
    <Card className="p-4 flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[220px]">
        <Label htmlFor="filtro-buscar" className="text-xs">Búsqueda</Label>
        <div className="relative">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            id="filtro-buscar"
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
            placeholder="Puerto, agente o naviera…"
            className="pl-8 pr-8"
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
      </div>
      <div className="min-w-[170px]">
        <Label htmlFor="filtro-aprob" className="text-xs">Aprobación</Label>
        <Select value={aprobacion} onValueChange={(v) => onAprobacionChange(v as AprobacionFiltro)}>
          <SelectTrigger id="filtro-aprob" aria-label="Filtrar por aprobación"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="borrador">Pendientes{pendientesCount > 0 ? ` (${pendientesCount})` : ""}</SelectItem>
            <SelectItem value="vigente">Aprobadas</SelectItem>
            <SelectItem value="rechazada">Rechazadas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[140px]">
        <Label htmlFor="filtro-estado" className="text-xs">Vigencia téc.</Label>
        <Select value={estado} onValueChange={(v) => onEstadoChange(v as EstadoFiltro)}>
          <SelectTrigger id="filtro-estado" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="vigente">Vigentes</SelectItem>
            <SelectItem value="vencida">Vencidas</SelectItem>
            <SelectItem value="reemplazada">Reemplazadas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[170px]">
        <Label htmlFor="filtro-agente" className="text-xs">Agente</Label>
        <Select value={agenteId} onValueChange={onAgenteChange}>
          <SelectTrigger id="filtro-agente" aria-label="Filtrar por agente"><SelectValue placeholder="Agente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los agentes</SelectItem>
            {agentes.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.nombre ?? a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[160px]">
        <Label htmlFor="filtro-tipo" className="text-xs">Contenedor</Label>
        <Select value={tipoId} onValueChange={onTipoChange}>
          <SelectTrigger id="filtro-tipo" aria-label="Filtrar por tipo de contenedor"><SelectValue placeholder="Contenedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name ?? t.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasActiveFilters && (
        <Button variant="ghost" onClick={onClearAll} className="text-xs">
          <X className="size-4 mr-1" />Limpiar
        </Button>
      )}
    </Card>
  );
}
