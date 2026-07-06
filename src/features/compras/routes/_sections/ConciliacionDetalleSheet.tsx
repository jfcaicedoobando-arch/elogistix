/**
 * Panel lateral con el desglose cotizado vs real de un embarque a nivel de
 * partidas (renglones), invocado desde /compras/conciliacion. Reusa
 * `fetchReconciliacionEmbarque` + funciones puras (`calcularResumen`,
 * `calcularResumenPorEstatus`, `calcularResumenPorMoneda`,
 * `fetchPartidasHuerfanasCount`) para presentar toda la información en línea
 * sin sacar al usuario de la pantalla.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Link2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/empty/EmptyState";
import { formatCurrency } from "@/lib/formatters";
import {
  fetchReconciliacionEmbarque,
  fetchPartidasHuerfanasCount,
  calcularResumen,
  calcularResumenPorEstatus,
  calcularResumenPorMoneda,
  type FilaReconciliacion,
  type EstatusRenglon,
} from "@/features/embarques/services/reconciliacionCostos";
import type { EmbarqueConciliacion } from "@/features/compras/services/conciliacionEmbarques";
import { CONCILIACION_ESTADO_LABELS } from "./conciliacionColumns";

interface Props {
  embarque: EmbarqueConciliacion | null;
  onClose: () => void;
}

const ESTATUS_META: Record<EstatusRenglon, { label: string; variant: "outline" | "default" | "secondary" | "destructive"; dot: string }> = {
  sin_match:  { label: "Sin match", variant: "destructive", dot: "bg-destructive" },
  parcial:    { label: "Parcial",   variant: "secondary",   dot: "bg-warning" },
  conciliado: { label: "Conciliado", variant: "default",    dot: "bg-success" },
  excedente:  { label: "Excedente", variant: "destructive", dot: "bg-destructive" },
};

export function ConciliacionDetalleSheet({ embarque, onClose }: Props) {
  const navigate = useNavigate();
  const embarqueId = embarque?.embarque_id ?? null;

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ["compras", "conciliacion-detalle", embarqueId],
    queryFn: () => fetchReconciliacionEmbarque(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });

  const { data: huerfanas = 0 } = useQuery({
    queryKey: ["compras", "conciliacion-huerfanas", embarqueId],
    queryFn: () => fetchPartidasHuerfanasCount(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });

  const resumen = useMemo(() => calcularResumen(filas), [filas]);
  const resumenEstatus = useMemo(() => calcularResumenPorEstatus(filas), [filas]);
  const totalesPorMoneda = useMemo(() => calcularResumenPorMoneda(filas), [filas]);

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const monedaResumen = embarque?.moneda ?? filas[0]?.moneda ?? "MXN";

  return (
    <Sheet open={Boolean(embarque)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        {embarque && (
          <>
            <SheetHeader className="space-y-2 pr-8">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="font-mono text-base">{embarque.expediente}</SheetTitle>
                <EstadoConciliacionBadge estado={embarque.estado_conciliacion} />
                {embarque.estado && (
                  <Badge variant="outline" className="text-xs">{embarque.estado}</Badge>
                )}
                <Badge variant="secondary" className="text-xs">{embarque.moneda}</Badge>
              </div>
              <SheetDescription>
                {embarque.cliente_nombre ?? "Cliente sin nombre"}
              </SheetDescription>
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/embarques/${embarque.embarque_id}`)}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir embarque
                </Button>
              </div>
            </SheetHeader>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid grid-cols-2 gap-2">
                <ResumenTile label="Cotizado" value={formatCurrency(resumen.total_cotizado, monedaResumen)} />
                <ResumenTile label="Real facturado" value={formatCurrency(resumen.total_real, monedaResumen)} />
                <ResumenTile
                  label="Diferencia"
                  value={formatCurrency(resumen.diferencia_total, monedaResumen)}
                  tone={resumen.diferencia_total > 0 ? "destructive" : resumen.diferencia_total < 0 ? "success" : "muted"}
                />
                <ResumenTile
                  label="Desviación %"
                  value={`${resumen.desviacion_pct_total.toFixed(1)}%`}
                  tone={resumen.desviacion_pct_total > 0 ? "destructive" : resumen.desviacion_pct_total < 0 ? "success" : "muted"}
                />
              </div>
              <div className="rounded-md border p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                  Renglones por estatus
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <EstatusCount label="Sin match" count={resumenEstatus.sin_match} tone="destructive" />
                  <EstatusCount label="Parcial" count={resumenEstatus.parcial} tone="warning" />
                  <EstatusCount label="Conciliado" count={resumenEstatus.conciliado} tone="success" />
                  <EstatusCount label="Excedente" count={resumenEstatus.excedente} tone="destructive" />
                </div>
                <div className="mt-2 pt-2 border-t text-[11px] text-muted-foreground flex justify-between">
                  <span>Partidas huérfanas</span>
                  <span className={huerfanas > 0 ? "text-destructive font-semibold" : "font-semibold"}>
                    {huerfanas}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : filas.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Sin conceptos de costo"
                  description="Este embarque no tiene conceptos de costo registrados para conciliar."
                />
              ) : (
                <>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="w-6 p-2"></th>
                          <th className="text-left p-2">Concepto</th>
                          <th className="text-right p-2">Cotizado</th>
                          <th className="text-right p-2">Real</th>
                          <th className="text-right p-2">Δ</th>
                          <th className="text-right p-2">%</th>
                          <th className="text-left p-2">Estatus</th>
                          <th className="w-16 p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((f) => (
                          <FilaRenglon
                            key={f.concepto_costo_id}
                            fila={f}
                            expandido={expandidos.has(f.concepto_costo_id)}
                            onToggle={() => toggle(f.concepto_costo_id)}
                            onVincular={() =>
                              navigate(
                                `/compras/por-aprobar?embarque=${encodeURIComponent(
                                  embarque.embarque_id,
                                )}&concepto=${encodeURIComponent(f.concepto_costo_id)}`,
                              )
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 space-y-1">
                    {totalesPorMoneda.map((t) => (
                      <div
                        key={t.moneda}
                        className="rounded-md border bg-muted/30 px-3 py-2 grid grid-cols-5 gap-2 text-xs tabular-nums"
                      >
                        <div className="font-semibold">TOTAL {t.moneda}</div>
                        <div className="text-right">{formatCurrency(t.cotizado, t.moneda)}</div>
                        <div className="text-right">{formatCurrency(t.real, t.moneda)}</div>
                        <div className={`text-right font-medium ${t.diferencia > 0 ? "text-destructive" : t.diferencia < 0 ? "text-success" : ""}`}>
                          {formatCurrency(t.diferencia, t.moneda)}
                        </div>
                        <div className={`text-right ${t.desviacion_pct > 0 ? "text-destructive" : t.desviacion_pct < 0 ? "text-success" : "text-muted-foreground"}`}>
                          {t.desviacion_pct.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FilaRenglon({
  fila,
  expandido,
  onToggle,
  onVincular,
}: {
  fila: FilaReconciliacion;
  expandido: boolean;
  onToggle: () => void;
  onVincular: () => void;
}) {
  const meta = ESTATUS_META[fila.estatus_renglon];
  const tienePartidas = fila.facturas.length > 0;
  const dCls = fila.diferencia > 0 ? "text-destructive font-medium"
    : fila.diferencia < 0 ? "text-success" : "text-muted-foreground";
  const pCls = fila.desviacion_pct > 0 ? "text-destructive"
    : fila.desviacion_pct < 0 ? "text-success" : "text-muted-foreground";

  return (
    <>
      <tr className="border-t hover:bg-muted/30">
        <td className="p-2 align-top">
          {tienePartidas ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={expandido ? "Ocultar partidas" : "Ver partidas"}
              className="text-muted-foreground hover:text-foreground"
            >
              {expandido ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </td>
        <td className="p-2 align-top">
          <div className="font-medium">{fila.concepto}</div>
          <div className="text-[10px] text-muted-foreground">{fila.proveedor_nombre || "—"}</div>
        </td>
        <td className="p-2 text-right tabular-nums align-top">
          {formatCurrency(fila.cotizado, fila.moneda)}
        </td>
        <td className="p-2 text-right tabular-nums align-top">
          {formatCurrency(fila.real_facturado, fila.moneda)}
        </td>
        <td className={`p-2 text-right tabular-nums align-top ${dCls}`}>
          {formatCurrency(fila.diferencia, fila.moneda)}
        </td>
        <td className={`p-2 text-right tabular-nums align-top ${pCls}`}>
          {fila.desviacion_pct.toFixed(1)}%
        </td>
        <td className="p-2 align-top">
          <Badge variant={meta.variant} className="gap-1 text-[10px]">
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </Badge>
        </td>
        <td className="p-2 align-top text-right">
          {!tienePartidas && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={onVincular}
            >
              <Link2 className="mr-1 h-3 w-3" /> Vincular
            </Button>
          )}
        </td>
      </tr>
      {expandido && tienePartidas && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-3 py-2">
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left py-1 font-normal">Folio</th>
                  <th className="text-left py-1 font-normal">Fecha</th>
                  <th className="text-left py-1 font-normal">Descripción</th>
                  <th className="text-right py-1 font-normal">Monto</th>
                  <th className="text-right py-1 font-normal">% cot.</th>
                </tr>
              </thead>
              <tbody>
                {fila.facturas.map((p) => {
                  const pct = fila.cotizado > 0 ? (p.monto / fila.cotizado) * 100 : 0;
                  return (
                    <tr key={p.proveedor_factura_id + p.folio_proveedor} className="border-t border-border/50">
                      <td className="py-1 font-mono">{p.folio_proveedor}</td>
                      <td className="py-1">{p.fecha_emision ?? "—"}</td>
                      <td className="py-1">{p.descripcion ?? "—"}</td>
                      <td className="py-1 text-right tabular-nums">{formatCurrency(p.monto, fila.moneda)}</td>
                      <td className="py-1 text-right tabular-nums text-muted-foreground">
                        {pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

function EstatusCount({ label, count, tone }: { label: string; count: number; tone: "destructive" | "warning" | "success" }) {
  const dot = tone === "destructive" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-success";
  const numCls = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-success";
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

function EstadoConciliacionBadge({ estado }: { estado: EmbarqueConciliacion["estado_conciliacion"] }) {
  const meta = CONCILIACION_ESTADO_LABELS[estado];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className="gap-1 text-xs">
      <Icon className="h-3 w-3" /> {meta.label}
    </Badge>
  );
}

type Tone = "destructive" | "success" | "muted" | "default";
function ResumenTile({ label, value, tone = "default" }: { label: string; value: string; tone?: Tone }) {
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
