/**
 * Chips de filtros activos de CxP. Patrón consistente con Embarques.
 * No incluye Search (tiene input visible propio).
 */
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";

interface ProveedorOption { id: string; nombre: string }
interface CategoriaOption { id: string; nombre: string }

export interface CxpFiltrosChipsProps {
  estatus: string;
  onEstatusChange: (v: string) => void;
  moneda: string;
  onMonedaChange: (v: string) => void;
  origen: string;
  onOrigenChange: (v: string) => void;
  proveedorId: string;
  onProveedorChange: (v: string) => void;
  categoriaPresupuestoId: string;
  onCategoriaPresupuestoChange: (v: string) => void;
  fechaDesde: string;
  onFechaDesdeChange: (v: string) => void;
  fechaHasta: string;
  onFechaHastaChange: (v: string) => void;
  proveedores: ProveedorOption[];
  categorias: CategoriaOption[];
  onClearAll: () => void;
}

interface ChipDef { key: string; label: string; value: string; onRemove: () => void }

interface FilterRule {
  key: string;
  label: string;
  isActive: (p: CxpFiltrosChipsProps) => boolean;
  getValue: (p: CxpFiltrosChipsProps) => string;
  reset: (p: CxpFiltrosChipsProps) => void;
}

const FILTER_RULES: FilterRule[] = [
  {
    key: "estatus", label: "Estatus",
    isActive: (p) => !!p.estatus && p.estatus !== "todos",
    getValue: (p) => p.estatus,
    reset: (p) => p.onEstatusChange("todos"),
  },
  {
    key: "moneda", label: "Moneda",
    isActive: (p) => !!p.moneda && p.moneda !== "todas",
    getValue: (p) => p.moneda,
    reset: (p) => p.onMonedaChange("todas"),
  },
  {
    key: "origen", label: "Origen",
    isActive: (p) => !!p.origen && p.origen !== "todos",
    getValue: (p) => p.origen,
    reset: (p) => p.onOrigenChange("todos"),
  },
  {
    key: "proveedor", label: "Proveedor",
    isActive: (p) => !!p.proveedorId && p.proveedorId !== "todos",
    getValue: (p) => p.proveedores.find((x) => x.id === p.proveedorId)?.nombre ?? "—",
    reset: (p) => p.onProveedorChange("todos"),
  },
  {
    key: "categoria", label: "Categoría",
    isActive: (p) => !!p.categoriaPresupuestoId && p.categoriaPresupuestoId !== "todas",
    getValue: (p) => p.categorias.find((x) => x.id === p.categoriaPresupuestoId)?.nombre ?? "—",
    reset: (p) => p.onCategoriaPresupuestoChange("todas"),
  },
  {
    key: "fechaDesde", label: "Emisión desde",
    isActive: (p) => !!p.fechaDesde,
    getValue: (p) => formatDate(p.fechaDesde),
    reset: (p) => p.onFechaDesdeChange(""),
  },
  {
    key: "fechaHasta", label: "Emisión hasta",
    isActive: (p) => !!p.fechaHasta,
    getValue: (p) => formatDate(p.fechaHasta),
    reset: (p) => p.onFechaHastaChange(""),
  },
];

/** Helper puro data-driven: filtra reglas activas y arma los chips. */
function buildChips(p: CxpFiltrosChipsProps): ChipDef[] {
  return FILTER_RULES
    .filter((r) => r.isActive(p))
    .map((r) => ({
      key: r.key,
      label: r.label,
      value: r.getValue(p),
      onRemove: () => r.reset(p),
    }));
}

export function CxpFiltrosChips(p: CxpFiltrosChipsProps) {
  const chips = buildChips(p);
  if (chips.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-2 pt-3 mt-3 border-t border-border">
      <span className="text-xs font-medium text-muted-foreground">Activos:</span>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pr-1 pl-2 py-1 text-xs font-normal"
        >
          <span className="text-muted-foreground">{chip.label}:</span>
          <span className="font-medium truncate max-w-[180px]">{chip.value}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Quitar filtro ${chip.label}`}
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-background/60 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost" size="sm"
        onClick={p.onClearAll}
        className="ml-auto h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        Limpiar todo
      </Button>
    </div>
  );
}
