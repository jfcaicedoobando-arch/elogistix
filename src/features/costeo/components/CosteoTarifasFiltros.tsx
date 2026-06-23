/**
 * Filtros de la matriz de tarifas marítimas.
 * v13.130.0: agrega filtro por aprobación (pendientes/aprobadas/rechazadas).
 */
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  agentes: OpcionId[];
  tipos: OpcionId[];
  pendientesCount: number;
}

export function CosteoTarifasFiltros({
  estado, onEstadoChange,
  aprobacion, onAprobacionChange,
  agenteId, onAgenteChange, tipoId, onTipoChange, agentes, tipos, pendientesCount,
}: Props) {
  return (
    <Card className="p-4 flex flex-wrap gap-3 items-end">
      <div className="min-w-[180px]">
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
      <div className="min-w-[180px]">
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
    </Card>
  );
}
