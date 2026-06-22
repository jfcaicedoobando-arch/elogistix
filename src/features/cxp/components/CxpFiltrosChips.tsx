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

export function CxpFiltrosChips(p: CxpFiltrosChipsProps) {
  const chips: ChipDef[] = [];

  if (p.estatus && p.estatus !== "todos") {
    chips.push({
      key: "estatus", label: "Estatus", value: p.estatus,
      onRemove: () => p.onEstatusChange("todos"),
    });
  }
  if (p.moneda && p.moneda !== "todas") {
    chips.push({
      key: "moneda", label: "Moneda", value: p.moneda,
      onRemove: () => p.onMonedaChange("todas"),
    });
  }
  if (p.origen && p.origen !== "todos") {
    chips.push({
      key: "origen", label: "Origen", value: p.origen,
      onRemove: () => p.onOrigenChange("todos"),
    });
  }
  if (p.proveedorId && p.proveedorId !== "todos") {
    const prov = p.proveedores.find((x) => x.id === p.proveedorId);
    chips.push({
      key: "proveedor", label: "Proveedor", value: prov?.nombre ?? "—",
      onRemove: () => p.onProveedorChange("todos"),
    });
  }
  if (p.categoriaPresupuestoId && p.categoriaPresupuestoId !== "todas") {
    const cat = p.categorias.find((x) => x.id === p.categoriaPresupuestoId);
    chips.push({
      key: "categoria", label: "Categoría", value: cat?.nombre ?? "—",
      onRemove: () => p.onCategoriaPresupuestoChange("todas"),
    });
  }
  if (p.fechaDesde) {
    chips.push({
      key: "fechaDesde", label: "Emisión desde", value: formatDate(p.fechaDesde),
      onRemove: () => p.onFechaDesdeChange(""),
    });
  }
  if (p.fechaHasta) {
    chips.push({
      key: "fechaHasta", label: "Emisión hasta", value: formatDate(p.fechaHasta),
      onRemove: () => p.onFechaHastaChange(""),
    });
  }

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
