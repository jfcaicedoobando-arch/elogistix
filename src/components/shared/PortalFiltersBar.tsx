import { type ReactNode } from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PortalFilterSelect {
  /** Valor actual del select. Usa "todos" para "sin filtro". */
  value: string;
  onChange: (v: string) => void;
  /** Opciones (además de "todos"). */
  options: string[];
  /** Placeholder del trigger. */
  placeholder: string;
  /** Icono opcional a la izquierda del trigger. */
  icon?: ReactNode;
  /** Label del ítem "todos". Default: "Todos". */
  allLabel?: string;
  /** Ancho del trigger en md+. Default: 200px. */
  width?: string;
  /** aria-label del trigger. */
  ariaLabel?: string;
}

interface PortalFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  /** Hasta 3 selects a la derecha del search. */
  selects?: PortalFilterSelect[];
  /** Oculta la barra en mobile (los portales usan un Sheet dedicado). Default: true. */
  hideOnMobile?: boolean;
  className?: string;
}

/**
 * Barra de filtros compartida para los portales (cliente, agente).
 *
 * Reemplaza la copia exacta de Input + Select en `PortalEmbarques`,
 * `PortalFacturas`, `PortalCotizaciones`. Para las listas de admin/CRM
 * usar `UnifiedFiltersBar` en su lugar.
 */
export function PortalFiltersBar({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  selects = [],
  hideOnMobile = true,
  className,
}: PortalFiltersBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row gap-3",
        hideOnMobile && "hidden sm:flex",
        className,
      )}
    >
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      {selects.map((s, i) => (
        <Select key={i} value={s.value} onValueChange={s.onChange}>
          <SelectTrigger
            className={cn("w-full sm:w-[200px]", s.width)}
            aria-label={s.ariaLabel ?? s.placeholder}
            title={s.placeholder}
          >
            {s.icon ?? <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />}
            <SelectValue placeholder={s.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">{s.allLabel ?? `Todos`}</SelectItem>
            {s.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}
