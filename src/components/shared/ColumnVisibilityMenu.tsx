/**
 * Menú compacto para mostrar/ocultar columnas de una `DataTable`.
 *
 * Se alimenta de `useColumnVisibility` (state + toggle + reset) y del
 * catálogo de columnas del caller. Renderiza un botón `Columnas` que abre
 * un popover con un checkbox por columna. Incluye "Restablecer".
 */
import { Columns3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ColumnOption {
  id: string;
  label: string;
  /** Cuando true, la columna no puede ocultarse (siempre visible). */
  required?: boolean;
}

interface Props {
  options: ColumnOption[];
  visibility: Record<string, boolean>;
  onToggle: (columnId: string) => void;
  onReset: () => void;
  isCustom: boolean;
}

export function ColumnVisibilityMenu({ options, visibility, onToggle, onReset, isCustom }: Props) {
  const visibleCount = options.filter((o) => visibility[o.id] !== false).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Configurar columnas">
          <Columns3 className="h-4 w-4 mr-2" />
          Columnas
          <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
            {visibleCount}/{options.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Columnas
          </span>
          {isCustom && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs"
              onClick={onReset}
              aria-label="Restablecer columnas a valores por defecto"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Restablecer
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
          {options.map((opt) => {
            const checked = visibility[opt.id] !== false;
            const disabled = !!opt.required;
            return (
              <label
                key={opt.id}
                className={`flex items-center gap-2 px-1.5 py-1 rounded-sm text-sm ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-accent"}`}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => !disabled && onToggle(opt.id)}
                  aria-label={`Mostrar columna ${opt.label}`}
                />
                <span className="flex-1">{opt.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
