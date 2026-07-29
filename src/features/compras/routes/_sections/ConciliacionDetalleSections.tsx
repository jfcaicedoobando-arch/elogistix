/**
 * Sub-secciones visuales del ConciliacionDetalleSheet: header, grid de KPIs y cuerpo
 * de tabla. Extraídas para respetar el techo Power of 10 (<200 líneas).
 */
import { ExternalLink, FileText } from "lucide-react";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import EmptyState from "@/components/empty/EmptyState";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/formatters";
import {
  calcularResumen,
  calcularResumenPorEstatus,
} from "@/features/embarques/services/reconciliacionCostos";
import type { EmbarqueConciliacion } from "@/features/compras/services/conciliacionEmbarques";
import {
  EstadoConciliacionBadge,
  EstatusCount,
  ResumenTile,
} from "./ConciliacionDetalleParts";
import { toneFromNumber } from "./ConciliacionDetalleHelpers";
import {
  TablaBody,
  TotalesMonedaFooter,
  type FilasType,
  type TotalesMoneda,
} from "./ConciliacionDetalleCuerpoTabla";

export function HeaderPanel({
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

export function ResumenGrid({
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
        <div className="text-2xs uppercase tracking-wide text-muted-foreground mb-2">
          Renglones por estatus
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <EstatusCount label="Sin match" count={resumenEstatus.sin_match} tone="destructive" />
          <EstatusCount label="Parcial" count={resumenEstatus.parcial} tone="warning" />
          <EstatusCount label="Conciliado" count={resumenEstatus.conciliado} tone="success" />
          <EstatusCount label="Excedente" count={resumenEstatus.excedente} tone="destructive" />
        </div>
        <div className="mt-2 pt-2 border-t text-label text-muted-foreground flex justify-between">
          <span>Partidas huérfanas</span>
          <span className={huerfanas > 0 ? "text-destructive font-semibold" : "font-semibold"}>
            {huerfanas}
          </span>
        </div>
      </div>
    </div>
  );
}




export function CuerpoTabla({
  isLoading, error, onRetry, filas, expandidos, onToggle, onVincular, totalesPorMoneda,
}: {
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  filas: FilasType;
  expandidos: Set<string>;
  onToggle: (id: string) => void;
  onVincular: (conceptoId: string) => void;
  totalesPorMoneda: TotalesMoneda;
}) {
  if (error) {
    return <ErrorStateInline message={getErrorMessage(error)} onRetry={onRetry} />;
  }
  if (isLoading) {
    return <ListSkeleton rows={3} />;
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
      <TablaBody filas={filas} expandidos={expandidos} onToggle={onToggle} onVincular={onVincular} />
      <TotalesMonedaFooter totalesPorMoneda={totalesPorMoneda} />
    </>
  );
}
