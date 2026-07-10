/**
 * Filtros mobile para la página de Mis Cotizaciones del portal.
 * DRY Lote 8b: shell compartido en `MobileFilterSheet`.
 */
import { Filter } from "lucide-react";
import { MobileFilterSheet } from "@/components/shared/MobileFilterSheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  estados: string[];
  filtroEstado: string;
  setFiltroEstado: (v: string) => void;
}

export function PortalCotizacionesMobileFilters({
  search,
  onSearchChange,
  estados,
  filtroEstado,
  setFiltroEstado,
}: Props) {
  const activeCount = filtroEstado !== "todos" ? 1 : 0;

  return (
    <MobileFilterSheet
      search={search}
      onSearchChange={onSearchChange}
      title="Filtros de cotizaciones"
      activeCount={activeCount}
      onClear={() => setFiltroEstado("todos")}
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
    </MobileFilterSheet>
  );
}
