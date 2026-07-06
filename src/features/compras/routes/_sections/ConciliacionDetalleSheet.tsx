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
import { ExternalLink, FileText } from "lucide-react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
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
} from "@/features/embarques/services/reconciliacionCostos";
import type { EmbarqueConciliacion } from "@/features/compras/services/conciliacionEmbarques";
import {
  EstadoConciliacionBadge,
  EstatusCount,
  ResumenTile,
  classFromNumber,
  toneFromNumber,
} from "./ConciliacionDetalleParts";
import { FilaRenglon } from "./ConciliacionDetalleFilaRenglon";

interface Props {
  embarque: EmbarqueConciliacion | null;
  onClose: () => void;
}

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
            <HeaderPanel embarque={embarque} onOpenEmbarque={() => navigate(`/embarques/${embarque.embarque_id}`)} />

            <ResumenGrid
              resumen={resumen}
              resumenEstatus={resumenEstatus}
              huerfanas={huerfanas}
              monedaResumen={monedaResumen}
            />

            <div className="mt-4">
              <CuerpoTabla
                isLoading={isLoading}
                filas={filas}
                expandidos={expandidos}
                onToggle={toggle}
                onVincular={(conceptoId) =>
                  navigate(
                    `/compras/por-aprobar?embarque=${encodeURIComponent(embarque.embarque_id)}` +
                    `&concepto=${encodeURIComponent(conceptoId)}`,
                  )
                }
                totalesPorMoneda={totalesPorMoneda}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function HeaderPanel({
  embarque, onOpenEmbarque,
}: {
  embarque: EmbarqueConciliacion;
  onOpenEmbarque: () => void;
}) {
  return (
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
        <Button size="sm" variant="outline" onClick={onOpenEmbarque}>
          <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir embarque
        </Button>
      </div>
    </SheetHeader>
  );
}

type ResumenBase = ReturnType<typeof calcularResumen>;
type ResumenEstatus = ReturnType<typeof calcularResumenPorEstatus>;

function ResumenGrid({
  resumen, resumenEstatus, huerfanas, monedaResumen,
}: {
  resumen: ResumenBase;
  resumenEstatus: ResumenEstatus;
  huerfanas: number;
  monedaResumen: string;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="grid grid-cols-2 gap-2">
        <ResumenTile label="Cotizado" value={formatCurrency(resumen.total_cotizado, monedaResumen)} />
        <ResumenTile label="Real facturado" value={formatCurrency(resumen.total_real, monedaResumen)} />
        <ResumenTile
          label="Diferencia"
          value={formatCurrency(resumen.diferencia_total, monedaResumen)}
          tone={toneFromNumber(resumen.diferencia_total)}
        />
        <ResumenTile
          label="Desviación %"
          value={`${resumen.desviacion_pct_total.toFixed(1)}%`}
          tone={toneFromNumber(resumen.desviacion_pct_total)}
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
  );
}

type FilasType = Awaited<ReturnType<typeof fetchReconciliacionEmbarque>>;
type TotalesMoneda = ReturnType<typeof calcularResumenPorMoneda>;

function CuerpoTabla({
  isLoading, filas, expandidos, onToggle, onVincular, totalesPorMoneda,
}: {
  isLoading: boolean;
  filas: FilasType;
  expandidos: Set<string>;
  onToggle: (id: string) => void;
  onVincular: (conceptoId: string) => void;
  totalesPorMoneda: TotalesMoneda;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  if (filas.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Sin conceptos de costo"
        description="Este embarque no tiene conceptos de costo registrados para conciliar."
      />
    );
  }
  return (
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
                onToggle={() => onToggle(f.concepto_costo_id)}
                onVincular={() => onVincular(f.concepto_costo_id)}
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
            <div className={`text-right font-medium ${classFromNumber(t.diferencia)}`}>
              {formatCurrency(t.diferencia, t.moneda)}
            </div>
            <div className={`text-right ${classFromNumber(t.desviacion_pct)}`}>
              {t.desviacion_pct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
