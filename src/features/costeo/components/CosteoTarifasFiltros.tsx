/**
 * Filtros de la matriz de tarifas marítimas.
 * Extraído de CosteoTarifas para cumplir Power of 10 (≤200 líneas).
 */
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { EstadoFiltro } from "../routes/CosteoTarifas.helpers";

interface OpcionId { id: string; nombre?: string; name?: string }

interface Props {
  estado: EstadoFiltro;
  onEstadoChange: (v: EstadoFiltro) => void;
  agenteId: string;
  onAgenteChange: (v: string) => void;
  tipoId: string;
  onTipoChange: (v: string) => void;
  agentes: OpcionId[];
  tipos: OpcionId[];
}

export function CosteoTarifasFiltros({
  estado, onEstadoChange, agenteId, onAgenteChange, tipoId, onTipoChange, agentes, tipos,
}: Props) {
  return (
    <Card className="p-4 flex flex-wrap gap-3">
      <div className="min-w-[140px]">
        <Label htmlFor="filtro-estado" className="sr-only">Estado</Label>
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
        <Label htmlFor="filtro-agente" className="sr-only">Agente</Label>
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
        <Label htmlFor="filtro-tipo" className="sr-only">Tipo de contenedor</Label>
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
