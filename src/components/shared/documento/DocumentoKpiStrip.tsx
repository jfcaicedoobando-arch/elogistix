/**
 * Cinta de KPIs del encabezado de un documento financiero.
 * Números en tipografía tabular, tono semántico opcional por métrica.
 */
import { cn } from "@/lib/utils";
import type { DocumentoKpi } from "@/lib/domain/documentoKpis";

export type { DocumentoKpi };

const TONE_CLASS: Record<NonNullable<DocumentoKpi["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

interface Props {
  kpis: DocumentoKpi[];
  className?: string;
}

export function DocumentoKpiStrip({ kpis, className }: Props) {
  if (kpis.length === 0) return null;
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4",
        className,
      )}
    >
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-card px-4 py-3">
          <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">
            {kpi.label}
          </p>
          <p className={cn("text-base font-semibold tabular-nums", TONE_CLASS[kpi.tone ?? "default"])}>
            {kpi.value}
          </p>
          {kpi.hint ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{kpi.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
