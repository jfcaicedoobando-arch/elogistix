/**
 * `<UnifiedFiltersBar />` — barra de filtros estándar consumida por listados.
 *
 * Componen: search + slots `primary` (selects visibles) + botón Sheet
 * (`secondary`) + chips activos con botón "Limpiar todo".
 */
import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { SearchInput } from "@/components/shared/SearchInput";
import { MobileFiltersSheet } from "@/components/shared/MobileFiltersSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChipItem } from "@/hooks/shared/useTableFilters";

export interface UnifiedFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  /** Filtros que se muestran siempre (ej. select de estado). */
  primary?: ReactNode;
  /** Filtros que se muestran dentro del Sheet lateral. */
  secondary?: ReactNode;
  chips: ChipItem[];
  activeCount: number;
  onClearAll: () => void;
  className?: string;
}

export function UnifiedFiltersBar({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar…",
  primary,
  secondary,
  chips,
  activeCount,
  onClearAll,
  className,
}: UnifiedFiltersBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasChips = chips.length > 0 || Boolean(search);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
          />
        </div>
        {primary ? <div className="flex flex-wrap items-center gap-2">{primary}</div> : null}
        {secondary ? (
          <MobileFiltersSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            activeCount={activeCount}
            onClearAll={onClearAll}
          >
            {secondary}
          </MobileFiltersSheet>
        ) : null}
      </div>
      {hasChips ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {search ? (
            <Badge variant="secondary" className="gap-1">
              <span>Búsqueda: {search}</span>
              <button
                type="button"
                aria-label="Quitar búsqueda"
                onClick={() => onSearchChange("")}
                className="ml-0.5 rounded-full p-0.5 hover:bg-background/60"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ) : null}
          {chips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1">
              <span>{chip.label}</span>
              <button
                type="button"
                aria-label={`Quitar ${chip.label}`}
                onClick={chip.onRemove}
                className="ml-0.5 rounded-full p-0.5 hover:bg-background/60"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
          {chips.length + (search ? 1 : 0) > 1 ? (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearAll}>
              Limpiar todo
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
