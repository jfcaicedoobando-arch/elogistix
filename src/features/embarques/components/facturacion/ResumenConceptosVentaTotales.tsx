/**
 * Resumen tri-estado "Pendiente" / "En proforma" / "Facturado" para
 * `ResumenConceptosVenta`. Extraído para mantener el componente padre
 * bajo Power-of-10 (≤200 líneas).
 */
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface TotalCurrency {
  totalUsd: number;
  totalMxn: number;
}

interface Props {
  totales: {
    pendiente: TotalCurrency;
    enProforma: TotalCurrency;
    facturado: TotalCurrency;
  };
  pendientesCount: number;
  enProformaCount: number;
  facturadosCount: number;
}

interface ColumnaProps {
  titulo: string;
  count: number;
  total: TotalCurrency;
  cardClass: string;
  badgeClass: string;
  icon: React.ReactNode;
  emptyText: string;
}

function ColumnaTotal({ titulo, count, total, cardClass, badgeClass, icon, emptyText }: ColumnaProps) {
  const vacio = total.totalMxn === 0 && total.totalUsd === 0;
  return (
    <div className={`rounded-md border p-3 ${cardClass}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-semibold">{titulo}</span>
        <Badge className={`ml-auto ${badgeClass}`}>{count}</Badge>
      </div>
      <div className="text-sm space-y-0.5">
        {total.totalMxn > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">MXN:</span><span className="font-semibold">{formatCurrency(total.totalMxn, "MXN")}</span></div>
        )}
        {total.totalUsd > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">USD:</span><span className="font-semibold">{formatCurrency(total.totalUsd, "USD")}</span></div>
        )}
        {vacio && <span className="text-muted-foreground text-xs">{emptyText}</span>}
      </div>
    </div>
  );
}

export function ResumenConceptosVentaTotales({
  totales, pendientesCount, enProformaCount, facturadosCount,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border-t bg-muted/30">
      <ColumnaTotal
        titulo="Pendiente"
        count={pendientesCount}
        total={totales.pendiente}
        cardClass="bg-background"
        badgeClass="bg-secondary text-secondary-foreground"
        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        emptyText="Sin conceptos pendientes"
      />
      <ColumnaTotal
        titulo="En proforma"
        count={enProformaCount}
        total={totales.enProforma}
        cardClass="border-info/30 bg-info/5"
        badgeClass="bg-info/15 [color:hsl(var(--info))] border-info/30"
        icon={<FileText className="h-4 w-4 [color:hsl(var(--info))]" />}
        emptyText="Sin proformas pendientes"
      />
      <ColumnaTotal
        titulo="Facturado"
        count={facturadosCount}
        total={totales.facturado}
        cardClass="border-success/30 bg-success/5"
        badgeClass="bg-success/15 [color:hsl(var(--success))] border-success/30"
        icon={<CheckCircle2 className="h-4 w-4 text-success" />}
        emptyText="Sin facturación emitida"
      />
    </div>
  );
}
