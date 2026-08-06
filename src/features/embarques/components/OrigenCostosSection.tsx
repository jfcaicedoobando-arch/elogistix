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
      <p className="px-3 py-1.5 text-label uppercase bg-muted/50 text-muted-foreground">
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
        <CardTitle className="flex items-center gap-2">
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

        {mismaTarifa && decision === "sin_cambios" ? (
          <TarifaChip
            label="Tarifa cotizada y aplicada"
            id={tarifaIdAplicada ?? null}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TarifaChip label="Tarifa cotizada" id={tarifaIdOriginal ?? null} />
            <TarifaChip
              label="Tarifa aplicada"
              id={tarifaIdAplicada ?? null}
              suffix={mismaTarifa ? "(misma)" : undefined}
            />
          </div>
        )}

        {cambios.length > 0 && <DeltaTable cambios={cambios} />}
      </CardContent>
    </Card>
  );
}

function TarifaChip({
  label,
  id,
  suffix,
}: {
  label: string;
  id: string | null;
  suffix?: string;
}) {
  const { data: resumenes } = useTarifasResumen([id]);
  const resumen: TarifaResumen | undefined = id ? resumenes?.[id] : undefined;

  return (
    <div className="p-2 rounded border bg-muted/30" title={id ?? undefined}>
      <p className="text-label uppercase text-muted-foreground">{label}</p>
      {!id ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : resumen ? (
        <>
          <p className="text-sm font-medium">
            {resumen.naviera_nombre} · {resumen.puerto_origen_nombre} → {resumen.puerto_destino_nombre}
            {suffix && <span className="ml-2 text-label font-normal text-muted-foreground">{suffix}</span>}
          </p>
          <p className="text-label text-muted-foreground">
            {resumen.tipo_contenedor_nombre}
            {resumen.vigente_desde && resumen.vigente_hasta && (
              <>
                {" · Vigencia "}
                {formatDate(resumen.vigente_desde, "dd/MM/yy")} – {formatDate(resumen.vigente_hasta, "dd/MM/yy")}
              </>
            )}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Tarifa no encontrada <span className="font-mono">…{id.slice(-8)}</span>
        </p>
      )}
    </div>
  );
}
