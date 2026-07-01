/**
 * Sección "Origen de costos" del detalle de embarque.
 *
 * Muestra cómo se generó la columna "Cotizado" del embarque:
 *  - Tarifa originalmente cotizada
 *  - Tarifa efectivamente aplicada al crear el embarque
 *  - Decisión tomada por operaciones (sin_cambios, refrescada, sustituida,
 *    mantenida_por_operaciones, reaprobada_ventas)
 *  - Snapshot del delta capturado al momento de la conversión
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { useTarifasResumen } from "@/features/costeo/hooks/useTarifasResumen";
import type { TarifaResumen } from "@/features/costeo/services/tarifas";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const DECISION_LABEL: Record<string, { label: string; variant: BadgeVariant }> = {
  sin_cambios:               { label: "Sin cambios",                    variant: "secondary" },
  mantenida_por_operaciones: { label: "Mantenida por operaciones",      variant: "outline"   },
  refrescada:                { label: "Refrescada (tarifa vigente)",    variant: "default"   },
  sustituida:                { label: "Sustituida (otra tarifa)",       variant: "default"   },
  reaprobada_ventas:         { label: "Re-aprobada por ventas",         variant: "default"   },
};

interface DeltaConcepto {
  concepto?: string;
  moneda?: string;
  monto_anterior?: number | null;
  monto_actual?: number | null;
  delta_abs?: number | null;
  delta_pct?: number | null;
  motivo?: string;
}

interface Props {
  tarifaIdOriginal: string | null | undefined;
  tarifaIdAplicada: string | null | undefined;
  decision: string | null | undefined;
  deltaJsonb: unknown;
  revalidadaEn: string | null | undefined;
}

/** Extrae el array de cambios del JSONB, sin importar si viene plano u envuelto. */
function extraerCambios(deltaJsonb: unknown): DeltaConcepto[] {
  if (Array.isArray(deltaJsonb)) return deltaJsonb as DeltaConcepto[];
  const obj = deltaJsonb as { cambios?: DeltaConcepto[] } | null;
  return obj?.cambios ?? [];
}

function DeltaTable({ cambios }: { cambios: DeltaConcepto[] }) {
  const sufijo = cambios.length === 1 ? "" : "s";
  return (
    <div className="border rounded-md overflow-hidden">
      <p className="px-3 py-1.5 text-[11px] uppercase bg-muted/50 text-muted-foreground">
        Snapshot del delta al convertir ({cambios.length} concepto{sufijo})
      </p>
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr className="text-left">
            <th className="px-3 py-1.5">Concepto</th>
            <th className="px-3 py-1.5 text-right">Cotizado</th>
            <th className="px-3 py-1.5 text-right">Vigente</th>
            <th className="px-3 py-1.5 text-right">Δ%</th>
          </tr>
        </thead>
        <tbody>
          {cambios.map((c, i) => (
            <tr key={`${c.concepto ?? "x"}-${i}`} className="border-t">
              <td className="px-3 py-1.5">{c.concepto ?? "—"}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{c.monto_anterior ?? "—"}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{c.monto_actual ?? "—"}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {c.delta_pct == null ? "—" : `${c.delta_pct}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrigenCostosSection({
  tarifaIdOriginal, tarifaIdAplicada, decision, deltaJsonb, revalidadaEn,
}: Props) {
  // Si no hay datos de revalidación (embarques viejos), no mostramos la sección.
  if (!decision && !tarifaIdOriginal && !tarifaIdAplicada) return null;

  const meta = decision
    ? DECISION_LABEL[decision] ?? { label: decision, variant: "outline" as const }
    : null;
  const cambios = extraerCambios(deltaJsonb);
  const mismaTarifa = !!tarifaIdOriginal && tarifaIdOriginal === tarifaIdAplicada;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          Origen de costos
        </CardTitle>
        <CardDescription className="text-xs">
          Decisión aplicada al convertir la cotización en este embarque.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Decisión:</span>
          {meta ? <Badge variant={meta.variant}>{meta.label}</Badge> : <span className="text-muted-foreground">—</span>}
          {revalidadaEn && (
            <span className="text-xs text-muted-foreground">· {formatDate(revalidadaEn, "dd/MM/yyyy HH:mm")}</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-2 rounded border bg-muted/30">
            <p className="text-[11px] uppercase text-muted-foreground">Tarifa cotizada</p>
            <p className="font-mono text-xs break-all">{tarifaIdOriginal ?? "—"}</p>
          </div>
          <div className="p-2 rounded border bg-muted/30">
            <p className="text-[11px] uppercase text-muted-foreground">Tarifa aplicada</p>
            <p className="font-mono text-xs break-all">
              {tarifaIdAplicada ?? "—"}
              {mismaTarifa && <span className="ml-2 text-[11px] text-muted-foreground">(misma)</span>}
            </p>
          </div>
        </div>

        {cambios.length > 0 && <DeltaTable cambios={cambios} />}
      </CardContent>
    </Card>
  );
}
