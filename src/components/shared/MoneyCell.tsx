/**
 * MoneyCell — celda canónica para montos en grids estrechos (móvil 402×874).
 *
 * Resuelve la familia de bugs de "$1,2…" en cards con `grid-cols-3/5` donde
 * el valor completo (`formatCurrency`) no cabe en ~66–115 px.
 *
 * Convenciones:
 *  - `min-w-0` + `truncate` para no romper el grid.
 *  - `Hint` con `fullValue` (o `value` si no se pasa) para exponer el monto
 *    completo truncado (tooltip accesible; sin `title` nativo — CI-02).
 *  - `tabular-nums` para alinear dígitos.
 *  - `text-body sm:text-base` — jerarquía adaptativa; `highlight` sube a `accent`.
 *
 * Uso preferente: `MoneyCell label="Total" value={compact} fullValue={complete} highlight />`.
 */
import { cn } from "@/lib/utils";
import { Hint } from "@/components/shared/Hint";

interface MoneyCellProps {
  label: string;
  value: string;
  fullValue?: string;
  highlight?: boolean;
  className?: string;
  /** Clases extra para el importe (p.ej. `whitespace-nowrap` cuando el chip crece). */
  valueClassName?: string;
}

export function MoneyCell({
  label,
  value,
  fullValue,
  highlight,
  className,
  valueClassName,
}: MoneyCellProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 min-w-0",
        highlight && "bg-accent/5 border-accent/40 ring-1 ring-accent/20",
        className,
      )}
    >
      <p className="text-overline font-medium truncate">
        {label}
      </p>
      <Hint label={fullValue ?? value}>
        <p
          className={cn(
            "text-body sm:text-base font-semibold tabular-nums truncate",
            highlight ? "text-accent" : "text-foreground",
          valueClassName,
          )}
        >
          {value}
        </p>
      </Hint>
    </div>
  );
}
