/**
 * Vista ejecutiva del módulo de Auditoría.
 *
 * Pensada para el director general / dirección de operaciones: NO lista
 * hallazgos individuales, expone salud operativa, distribuciones y rankings
 * accionables. La pestaña "Detalle operativo" sigue conservando el desglose
 * tradicional para los operadores.
 */
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReglaAuditoria } from "@/types/auditoria";
import type { AuditoriaEjecutivoData } from "@/hooks/auditoria/useAuditoriaEjecutivo";
import { useAutoCapturarSnapshot } from "@/hooks/auditoria/useAuditoriaSnapshots";
import { AuditoriaTendenciaChart } from "./AuditoriaTendenciaChart";
import { AuditoriaOperadoresCard } from "./AuditoriaOperadoresCard";
import { AuditoriaRiesgoFinancieroCard } from "./AuditoriaRiesgoFinancieroCard";

const reglaLabel: Record<ReglaAuditoria, string> = {
  docs_faltantes: "Docs faltantes según etapa",
  docs_pendientes_avanzado: "Docs pendientes en avanzados",
  fechas: "Inconsistencias de fechas",
  ventas_sin_facturar: "Ventas sin facturar",
  margen_negativo: "Margen negativo",
  margen_bajo: "Margen bajo",
  venta_sin_costo: "Venta sin costo cargado",
  costo_sin_venta: "Costo sin venta facturable",
  proforma_vencida: "Proforma vencida sin factura",
  embarque_huerfano: "Embarque huérfano",
};

const scoreEstadoConfig = {
  excelente: {
    label: "Excelente",
    text: "text-success",
    accent: "bg-success",
    msg: "Operación bajo control. Sin hallazgos críticos pendientes.",
  },
  bueno: {
    label: "Bueno",
    text: "text-info",
    accent: "bg-info",
    msg: "Algunos pendientes menores. Operación sana.",
  },
  regular: {
    label: "Regular",
    text: "text-warning",
    accent: "bg-warning",
    msg: "Hay pendientes que requieren atención esta semana.",
  },
  malo: {
    label: "Atención",
    text: "text-destructive",
    accent: "bg-destructive",
    msg: "Pendientes críticos acumulados. Acción inmediata recomendada.",
  },
} as const;

interface Props {
  data: AuditoriaEjecutivoData;
  /** Permite saltar a la pestaña de detalle con un filtro pre-aplicado. */
  onDrillDown?: (filtro: {
    severidad?: "critico" | "alto" | "medio";
    cliente?: string;
    etapa?: string;
    soloVencidos?: boolean;
  }) => void;
}

export function AuditoriaEjecutivoTab({ data, onDrillDown }: Props) {
  // Captura idempotente del snapshot del día (UNIQUE org+fecha en BD).
  useAutoCapturarSnapshot(!data.isLoading);

  if (data.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40 md:col-span-2" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const cfg = scoreEstadoConfig[data.scoreEstado];

  return (
    <div className="space-y-4">
      {/* Fila 1: Score + KPI compactos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Salud operativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-3">
              <div className={cn("text-5xl font-bold tabular-nums", cfg.text)}>
                {data.score}
              </div>
              <div className="text-sm text-muted-foreground pb-2">/ 100</div>
              <Badge variant="outline" className={cn("ml-auto", cfg.text)}>
                {cfg.label}
              </Badge>
            </div>
            <Progress value={data.score} className="h-2" />
            <p className="text-xs text-muted-foreground">{cfg.msg}</p>
            <div className="grid grid-cols-3 gap-3 pt-1 text-center">
              <DrillKpi
                label="Críticos"
                value={data.porSeveridad.critico}
                tone="text-destructive"
                onClick={() => onDrillDown?.({ severidad: "critico" })}
              />
              <DrillKpi
                label="Altos"
                value={data.porSeveridad.alto}
                tone="text-warning"
                onClick={() => onDrillDown?.({ severidad: "alto" })}
              />
              <DrillKpi
                label="Medios"
                value={data.porSeveridad.medio}
                tone="text-primary"
                onClick={() => onDrillDown?.({ severidad: "medio" })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Atención de hallazgos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="text-4xl font-bold tabular-nums text-foreground">
                {data.porcentajeAtendidos}
                <span className="text-xl text-muted-foreground">%</span>
              </div>
            </div>
            <Progress value={data.porcentajeAtendidos} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground tabular-nums">
                  {data.totalRevisados}
                </span>{" "}
                revisados
              </span>
              <span>
                <span className="font-semibold text-foreground tabular-nums">
                  {data.totalPendientes}
                </span>{" "}
                pendientes
              </span>
            </div>
            {data.edadPromediaPendientesDias !== null && (
              <div className="text-xs text-muted-foreground border-t pt-2">
                Edad promedio de hallazgos vencidos:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {data.edadPromediaPendientesDias}
                </span>{" "}
                {data.edadPromediaPendientesDias === 1 ? "día" : "días"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas de urgencia por ETA */}
      {(data.pendientesVencidos > 0 || data.pendientesUrgentesPorEta > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.pendientesVencidos > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-destructive">
                    {data.pendientesVencidos} hallazgo
                    {data.pendientesVencidos === 1 ? "" : "s"} en embarques con ETA vencida
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Embarques que ya debieron arribar y aún tienen pendientes sin atender.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDrillDown?.({ soloVencidos: true })}
                >
                  Revisar
                </Button>
              </CardContent>
            </Card>
          )}
          {data.pendientesUrgentesPorEta > 0 && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="p-4 flex items-start gap-3">
                <CalendarClock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-warning">
                    {data.pendientesUrgentesPorEta} hallazgo
                    {data.pendientesUrgentesPorEta === 1 ? "" : "s"} con ETA en ≤ 3 días
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Atender antes del arribo para no impactar entrega al cliente.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Fila 2: Distribución por etapa + Top clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Pendientes por etapa del embarque
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.porEtapa.length === 0 ? (
              <EmptyMsg msg="Sin pendientes." />
            ) : (
              <DistribucionBarras
                items={data.porEtapa.map((e) => ({
                  label: e.etapa,
                  total: e.total,
                  destacado: e.criticos,
                  destacadoLabel: "críticos",
                  onClick: () => onDrillDown?.({ etapa: e.etapa }),
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top 5 clientes con pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topClientes.length === 0 ? (
              <EmptyMsg msg="Sin pendientes por cliente." />
            ) : (
              <DistribucionBarras
                items={data.topClientes.map((c) => ({
                  label: c.cliente,
                  total: c.total,
                  destacado: c.criticos,
                  destacadoLabel: "críticos",
                  onClick: () => onDrillDown?.({ cliente: c.cliente }),
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fila 3: Pendientes por regla */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pendientes por regla de auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.keys(data.porRegla) as ReglaAuditoria[]).map((r) => (
              <div
                key={r}
                className="rounded-md border p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="text-2xl font-bold tabular-nums">
                  {data.porRegla[r]}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {reglaLabel[r]}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ──────────────── helpers visuales internos ──────────────── */

function DrillKpi({
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

function DistribucionBarras({
  items,
}: {
  items: Array<{
    label: string;
    total: number;
    destacado: number;
    destacadoLabel: string;
    onClick?: () => void;
  }>;
}) {
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

function EmptyMsg({ msg }: { msg: string }) {
  return (
    <div className="text-xs text-muted-foreground py-6 text-center">{msg}</div>
  );
}
