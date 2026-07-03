import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
  /** Renderiza el valor en `font-mono tabular-nums` (útil para RFC, folios, montos). */
  mono?: boolean;
  /** Oculta el ítem si el valor es null/undefined/"". */
  hideEmpty?: boolean;
  /** Span de columnas en md+ (para grids de 2 columnas). */
  colSpan?: 1 | 2;
}

interface DescriptionListProps {
  items: DescriptionItem[];
  /** Número de columnas en md+. `1` = lista vertical, `2` = grid. Default: 1. */
  columns?: 1 | 2;
  /** Placeholder cuando el valor es null/undefined/"". Default: "—". */
  emptyPlaceholder?: string;
  className?: string;
}

/**
 * Lista de pares `label: valor` con estilo consistente.
 *
 * Reemplaza los `<p><span className="text-muted-foreground">RFC:</span> {rfc}</p>`
 * duplicados en tarjetas de detalle (Cliente, Proveedor, portal, etc.).
 */
export function DescriptionList({
  items,
  columns = 1,
  emptyPlaceholder = "—",
  className,
}: DescriptionListProps) {
  const visible = items.filter((it) => {
    if (!it.hideEmpty) return true;
    return it.value !== null && it.value !== undefined && it.value !== "";
  });

  return (
    <dl
      className={cn(
        "grid gap-x-4 gap-y-2 text-sm",
        columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1",
        className,
      )}
    >
      {visible.map((it, i) => {
        const value =
          it.value === null || it.value === undefined || it.value === ""
            ? emptyPlaceholder
            : it.value;
        return (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-0.5 min-w-0",
              it.colSpan === 2 && "md:col-span-2",
            )}
          >
            <dt className="text-xs text-muted-foreground">{it.label}</dt>
            <dd
              className={cn(
                "text-sm text-foreground truncate",
                it.mono && "font-mono tabular-nums",
              )}
            >
              {value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
