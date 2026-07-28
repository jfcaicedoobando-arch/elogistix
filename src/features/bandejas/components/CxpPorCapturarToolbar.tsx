/**
 * Toolbar de la bandeja CxP — Por capturar.
 * Buscador, chips de filtro, ordenamiento y contador.
 */
import { ArrowDownAZ, ArrowUpZA, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  AntiguedadFiltro, DireccionOrden, EstatusFiltro, FiltersState, OrdenarPor,
} from "@/features/bandejas/hooks/useCxpPorCapturarFilters";

interface Props {
  state: FiltersState;
  set: <K extends keyof FiltersState>(k: K, v: FiltersState[K]) => void;
  toggleDireccion: () => void;
  reset: () => void;
  isFiltered: boolean;
  totalFiltradas: number;
  totalGlobal: number;
}

const ESTATUS: { value: EstatusFiltro; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "sin", label: "Sin facturas" },
  { value: "parcial", label: "Parciales" },
  { value: "completo", label: "Completas" },
];

const ANTIGUEDAD: { value: AntiguedadFiltro; label: string }[] = [
  { value: "todos", label: "Todas" },
  { value: "sin_captura", label: "Sin captura" },
  { value: "gt7", label: ">7 días" },
  { value: "gt30", label: ">30 días" },
];

function ChipGroup<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}:</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              "px-2.5 py-1 text-xs rounded-full border transition-colors " +
              (value === o.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-input text-foreground/80")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CxpPorCapturarToolbar({
  state, set, toggleDireccion, reset, isFiltered, totalFiltradas, totalGlobal,
}: Props) {
  return (
    <div className="space-y-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={state.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Buscar por expediente o cliente…"
            className="pl-8 h-9"
          />
        </div>

        <Select value={state.ordenarPor} onValueChange={(v) => set("ordenarPor", v as OrdenarPor)}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="antiguedad">Antigüedad</SelectItem>
            <SelectItem value="expediente">Expediente</SelectItem>
            <SelectItem value="monto">Monto</SelectItem>
            <SelectItem value="facturas"># Facturas</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleDireccion}
          className="h-9"
          aria-label={`Orden ${state.direccion === "asc" ? "ascendente" : "descendente"}`}
        >
          {state.direccion === "asc"
            ? <ArrowDownAZ className="h-4 w-4" />
            : <ArrowUpZA className="h-4 w-4" />}
        </Button>

        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {isFiltered ? `${totalFiltradas} de ${totalGlobal}` : `${totalGlobal}`} embarques
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <ChipGroup<EstatusFiltro>
          label="Estatus"
          value={state.estatus}
          options={ESTATUS}
          onChange={(v) => set("estatus", v)}
        />
        <ChipGroup<AntiguedadFiltro>
          label="Última factura"
          value={state.antiguedad}
          options={ANTIGUEDAD}
          onChange={(v) => set("antiguedad", v)}
        />
        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-7 ml-auto">
            <X className="h-3 w-3 mr-1" /> Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
}

;
