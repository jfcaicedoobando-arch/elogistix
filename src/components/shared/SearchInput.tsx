import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Clases extra para el `<input>` (ancho, alto compacto en toolbars densas). */
  inputClassName?: string;
  "aria-label"?: string;
}

/**
 * Buscador estándar de listados y toolbars.
 *
 * v13.430.0 — antes forzaba `bg-muted/30 rounded-lg`, así que se veía distinto
 * a cualquier otro campo del formulario. Ahora hereda la superficie y el anillo
 * de foco canónicos de `Input`; solo agrega el icono de lupa.
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  className,
  inputClassName,
  "aria-label": ariaLabel,
}: SearchInputProps) {
  // v13.823.77 — el filtro se quedaba pegado cuando el input llegaba a vacío
  // por una vía que React no traduce a `onChange` (botón nativo de limpiar de
  // `type="search"`, borrado programático). Analogía: la cajita se veía vacía
  // pero el pedido seguía en la cocina. Sincronizamos también con el evento
  // nativo `input`, comparando contra el valor actual para no emitir cambios
  // repetidos.

  const sync = (next: string) => {
    if (next !== value) onChange(next);
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onInput={(e) => sync(e.currentTarget.value)}
        className={cn("pl-9", inputClassName)}
      />
    </div>
  );
}

