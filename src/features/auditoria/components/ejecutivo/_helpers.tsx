/**
 * Helpers visuales internos compartidos por las tarjetas del resumen ejecutivo
 * de Auditoría. Antes vivían inline en AuditoriaEjecutivoTab.
 */
import { cn } from "@/lib/utils";

export function DrillKpi({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-md border p-2 transition-colors",
        onClick && "hover:bg-muted/40 cursor-pointer text-left",
      )}
    >
      <div className={cn("text-2xl font-bold tabular-nums", tone)}>
        {value.toLocaleString("es-MX")}
      </div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
    </Comp>
  );
}

export interface DistribucionItem {
  label: string;
  total: number;
  destacado: number;
  destacadoLabel: string;
  onClick?: () => void;
}

export function DistribucionBarras({ items }: { items: DistribucionItem[] }) {
  const max = Math.max(...items.map((i) => i.total), 1);
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const pct = (it.total / max) * 100;
        const pctDestacado = it.total > 0 ? (it.destacado / it.total) * 100 : 0;
        const Comp = it.onClick ? "button" : "div";
        return (
          <Comp
            key={it.label}
            type={it.onClick ? "button" : undefined}
            onClick={it.onClick}
            className={cn(
              "w-full text-left space-y-1",
              it.onClick && "hover:bg-muted/30 rounded-md p-1 -m-1 transition-colors",
            )}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="truncate font-medium" title={it.label}>
                {it.label}
              </span>
              <span className="tabular-nums text-muted-foreground shrink-0 ml-2">
                {it.total}
                {it.destacado > 0 && (
                  <span className="text-destructive ml-1">
                    ({it.destacado} {it.destacadoLabel})
                  </span>
                )}
              </span>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-primary/70 rounded-full"
                style={{ width: `${pct}%` }}
              />
              {it.destacado > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-destructive rounded-full"
                  style={{ width: `${(pct * pctDestacado) / 100}%` }}
                />
              )}
            </div>
          </Comp>
        );
      })}
    </div>
  );
}

export function EmptyMsg({ msg }: { msg: string }) {
  return <div className="text-xs text-muted-foreground py-6 text-center">{msg}</div>;
}
