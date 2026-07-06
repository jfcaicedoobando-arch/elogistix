/**
 * Sub-componentes visuales del panel de conciliación por partida
 * (`ConciliacionDetalleSheet`). Extraídos para mantener el componente
 * principal bajo el límite de complejidad ciclomática y de líneas.
 */
import { Badge } from "@/components/ui/badge";
import type { EstatusRenglon } from "@/features/embarques/services/reconciliacionCostos";
import type { EmbarqueConciliacion } from "@/features/compras/services/conciliacionEmbarques";
import { CONCILIACION_ESTADO_LABELS } from "./conciliacionColumns";

export const ESTATUS_META: Record<
  EstatusRenglon,
  { label: string; variant: "outline" | "default" | "secondary" | "destructive"; dot: string }
> = {
  sin_match:  { label: "Sin match",  variant: "destructive", dot: "bg-destructive" },
  parcial:    { label: "Parcial",    variant: "secondary",   dot: "bg-warning" },
  conciliado: { label: "Conciliado", variant: "default",     dot: "bg-success" },
  excedente:  { label: "Excedente",  variant: "destructive", dot: "bg-destructive" },
};

export type ResumenTileTone = "destructive" | "success" | "muted" | "default";
export function ResumenTile({
  label, value, tone = "default",
}: { label: string; value: string; tone?: ResumenTileTone }) {
  const toneClass =
    tone === "destructive" ? "text-destructive"
    : tone === "success" ? "text-success"
    : tone === "muted" ? "text-muted-foreground"
    : "text-foreground";
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

export function EstatusCount({
  label, count, tone,
}: { label: string; count: number; tone: "destructive" | "warning" | "success" }) {
  const dot =
    tone === "destructive" ? "bg-destructive"
    : tone === "warning" ? "bg-warning"
    : "bg-success";
  const numCls =
    tone === "destructive" ? "text-destructive"
    : tone === "warning" ? "text-warning"
    : "text-success";
  return (
    <div className="flex items-center justify-between rounded border px-2 py-1">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className={`font-semibold tabular-nums ${numCls}`}>{count}</span>
    </div>
  );
}

export function EstadoConciliacionBadge({
  estado,
}: { estado: EmbarqueConciliacion["estado_conciliacion"] }) {
  const meta = CONCILIACION_ESTADO_LABELS[estado];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className="gap-1 text-xs">
      <Icon className="h-3 w-3" /> {meta.label}
    </Badge>
  );
}

export function toneFromNumber(n: number): ResumenTileTone {
  if (n > 0) return "destructive";
  if (n < 0) return "success";
  return "muted";
}

export function classFromNumber(n: number): string {
  if (n > 0) return "text-destructive";
  if (n < 0) return "text-success";
  return "text-muted-foreground";
}
