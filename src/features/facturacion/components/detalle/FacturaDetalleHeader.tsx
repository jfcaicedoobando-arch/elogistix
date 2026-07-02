/**
 * Encabezado visual de la página FacturaDetalle: título, badges y total.
 * Extraído para mantener FacturaDetalle ≤ 200 líneas.
 */
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";

interface Props {
  numero: string;
  estado: string;
  sinTimbrar: boolean;
  clienteNombre: string;
  expediente: string;
  total: number;
  moneda: string;
}

export function FacturaDetalleHeader(props: Props) {
  const { numero, estado, sinTimbrar, clienteNombre, expediente, total, moneda } = props;
  const vencida = estado === "Vencida";
  const esBorradorSinFolio = (numero ?? "").startsWith("BORRADOR-");
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold font-mono tabular-nums">
            {esBorradorSinFolio
              ? <span className="text-muted-foreground italic">Sin folio (borrador)</span>
              : numero}
          </h1>
          <Badge className={`${getEstadoColor(estado)} text-xs`}>{estado}</Badge>
          {sinTimbrar && <Badge variant="outline" className="text-xs">Sin timbrar</Badge>}
          {vencida && <AlertTriangle className="h-4 w-4 text-destructive" />}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {clienteNombre} • Exp: <span className="font-mono">{expediente}</span>
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground">Total</p>
        <p className="text-2xl font-bold tabular-nums text-accent">
          {formatCurrency(total, moneda)}
        </p>
      </div>
    </div>
  );
}
