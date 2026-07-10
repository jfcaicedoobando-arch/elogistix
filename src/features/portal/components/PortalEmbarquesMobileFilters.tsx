/**
 * Filtros mobile para la página de Mis Embarques del portal.
 * DRY Lote 8b: shell compartido en `MobileFilterSheet`.
 */
import { Filter, Ship } from "lucide-react";
import { MobileFilterSheet } from "@/components/shared/MobileFilterSheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  estados: string[];
  modos: string[];
  filtroEstado: string;
  setFiltroEstado: (v: string) => void;
  filtroModo: string;
  setFiltroModo: (v: string) => void;
}

export function PortalEmbarquesMobileFilters({
  search,
  onSearchChange,
  estados,
  modos,
  filtroEstado,
  setFiltroEstado,
  filtroModo,
  setFiltroModo,
}: Props) {
  const activeCount = (filtroEstado !== "todos" ? 1 : 0) + (filtroModo !== "todos" ? 1 : 0);

  const clearAll = () => {
    setFiltroEstado("todos");
    setFiltroModo("todos");
  };

  return (
    <MobileFilterSheet
      search={search}
      onSearchChange={onSearchChange}
      title="Filtros de embarques"
      activeCount={activeCount}
      onClear={clearAll}
    >
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Estado</label>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger>
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Modo</label>
        <Select value={filtroModo} onValueChange={setFiltroModo}>
          <SelectTrigger>
            <Ship className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Modo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los modos</SelectItem>
            {modos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </MobileFilterSheet>
  );
}
