/**
 * Ola D · #18 — Tooltip compartido para las gráficas (recharts).
 *
 * El tooltip por defecto de recharts pinta un recuadro blanco con texto negro
 * vía estilos inline: en modo oscuro queda ilegible y en claro no respeta los
 * tokens del design system. Este componente usa `bg-popover` / `border` /
 * `shadow-md`, alinea los valores a la derecha con `tabular-nums` y permite
 * formatear cada serie (moneda, porcentaje, enteros).
 *
 * Uso:
 *   <Tooltip content={<ChartTooltip formatValue={(v) => formatCurrency(v, "MXN")} />} />
 */
import { cn } from "@/lib/utils";

export interface ChartTooltipEntry {
  name?: string | number;
  dataKey?: string | number;
  value?: number | string | Array<number | string> | null;
  color?: string;
}

export interface ChartTooltipProps {
  /** Inyectado por recharts. */
  active?: boolean;
  /** Inyectado por recharts. */
  payload?: ChartTooltipEntry[];
  /** Inyectado por recharts (valor del eje X). */
  label?: string | number;
  /** Formatea el valor de cada serie; por defecto es-MX con separadores. */
  formatValue?: (valor: number, serie: string) => string;
  /** Formatea el encabezado (por defecto el `label` tal cual). */
  formatLabel?: (label: string | number) => string;
  className?: string;
}

/** Fallback es-MX: enteros sin decimales, decimales con dos. */
function formatoPorDefecto(valor: number): string {
  return valor.toLocaleString("es-MX", {
    minimumFractionDigits: Number.isInteger(valor) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function aNumero(valor: ChartTooltipEntry["value"]): number | null {
  const crudo = Array.isArray(valor) ? valor[valor.length - 1] : valor;
  if (crudo === null || crudo === undefined || crudo === "") return null;
  const n = Number(crudo);
  return Number.isFinite(n) ? n : null;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
  formatLabel,
  className,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const encabezado = formatLabel ? formatLabel(label ?? "") : String(label ?? "");

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-popover px-3 py-2 text-body-sm text-popover-foreground shadow-md",
        className,
      )}
    >
      {encabezado && <p className="mb-1 font-medium">{encabezado}</p>}
      <ul className="space-y-0.5">
        {payload.map((entry, i) => {
          const serie = String(entry.name ?? entry.dataKey ?? "");
          const valor = aNumero(entry.value);
          if (valor === null) return null;
          return (
            <li key={`${serie}-${i}`} className="flex items-center gap-2">
              {entry.color && (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
              )}
              <span className="flex-1 truncate text-muted-foreground">{serie}</span>
              <span className="font-medium tabular-nums">
                {formatValue ? formatValue(valor, serie) : formatoPorDefecto(valor)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
