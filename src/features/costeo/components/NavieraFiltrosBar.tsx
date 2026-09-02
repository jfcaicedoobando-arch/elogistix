/**
 * Barra de búsqueda + filtro segmentado para el catálogo de navieras.
 * Compartida por `CosteoNavieras` (interno) y `AgenteGarantias` (portal agente).
 */
import SearchInput from "@/components/shared/SearchInput";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ESTADO_NAVIERA_FILTRO_OPTIONS,
  type EstadoNavieraFiltro,
} from "@/features/costeo/lib/navierasFiltro";

interface Props {
  busqueda: string;
  onBusquedaChange: (v: string) => void;
  estado: EstadoNavieraFiltro;
  onEstadoChange: (v: EstadoNavieraFiltro) => void;
}

export function NavieraFiltrosBar({ busqueda, onBusquedaChange, estado, onEstadoChange }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <SearchInput
        value={busqueda}
        onChange={onBusquedaChange}
        placeholder="Buscar naviera por nombre…"
        className="sm:max-w-xs"
        aria-label="Buscar naviera"
      />
      <ToggleGroup
        type="single"
        value={estado}
        onValueChange={(v) => v && onEstadoChange(v as EstadoNavieraFiltro)}
        aria-label="Filtrar por estado de configuración"
        className="flex-wrap justify-start"
      >
        {ESTADO_NAVIERA_FILTRO_OPTIONS.map((opt) => (
          <ToggleGroupItem key={opt.value} value={opt.value} className="h-8 px-3 text-body-sm">
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
