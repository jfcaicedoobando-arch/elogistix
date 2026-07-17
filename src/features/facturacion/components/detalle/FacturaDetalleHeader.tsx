/**
 * Encabezado visual de la página FacturaDetalle: título, badges y total.
 * Extraído para mantener FacturaDetalle ≤ 200 líneas.
 */
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/formatters";
import { AmbienteBadge } from "@/features/facturacion/components/AmbienteBadge";
import { deriveFacturaBadgeEstado } from "@/features/facturacion/domain/facturaBadgeEstado";

interface Props {
  numero: string;
  estado: string;
  acuseCancelacionStatus?: string | null;
  cancellationStatus?: string | null;
  sinTimbrar: boolean;
  clienteNombre: string;
  expediente: string;
  total: number;
  moneda: string;
  ambiente?: "sandbox" | "live" | null;
}

export function FacturaDetalleHeader(props: Props) {
  const {
    numero, estado, acuseCancelacionStatus, cancellationStatus, sinTimbrar,
    clienteNombre, expediente, total, moneda, ambiente,
  } = props;
  const vencida = estado === "Vencida";
  const esBorradorSinFolio = (numero ?? "").startsWith("BORRADOR-");
  const estadoVisual = deriveFacturaBadgeEstado(estado, acuseCancelacionStatus, cancellationStatus);
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold font-mono tabular-nums">
            {esBorradorSinFolio
              ? <span className="text-muted-foreground italic">Sin folio (borrador)</span>
              : numero}
          </h1>
          <StatusBadge domain="factura" status={estadoVisual} />
          {sinTimbrar && <Badge variant="outline" className="text-xs">Sin timbrar</Badge>}
          <AmbienteBadge ambiente={ambiente} size="md" />
          {vencida && <AlertTriangle className="h-4 w-4 text-destructive" />}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {clienteNombre} • Exp: <span className="font-mono">{expediente}</span>
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total</p>
        <p className="text-lg font-semibold tabular-nums text-foreground">
          {formatCurrency(total, moneda)}
        </p>
      </div>
    </div>
  );
}
