/**
 * Encabezado visual de la página FacturaDetalle: título, badges, enlaces
 * de contexto (expediente / proforma) y total con saldo pendiente.
 * v13.308.16: se removió la duplicación del cliente (vive en Receptor)
 * y el expediente pasó a ser link clickable al embarque.
 * v13.320.67: migrado al componente canónico `DetailHeader` (el botón
 * "Volver" ya vive dentro del encabezado, no suelto arriba de la página).
 */
import { AlertTriangle, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { formatCurrency } from "@/lib/formatters";
import { AmbienteBadge } from "@/features/facturacion/components/AmbienteBadge";
import { deriveFacturaBadgeEstado } from "@/features/facturacion/domain/facturaBadgeEstado";

interface Props {
  numero: string;
  estado: string;
  acuseCancelacionStatus?: string | null;
  cancellationStatus?: string | null;
  sinTimbrar: boolean;
  expediente: string;
  embarqueId?: string | null;
  proformaId?: string | null;
  proformaNumero?: string | null;
  total: number;
  saldo?: number;
  moneda: string;
  ambiente?: "sandbox" | "live" | null;
  volverHref?: string;
  volverLabel?: string;
}

export function FacturaDetalleHeader(props: Props) {
  const {
    numero, estado, acuseCancelacionStatus, cancellationStatus, sinTimbrar,
    expediente, embarqueId, proformaId, proformaNumero, total, saldo, moneda, ambiente,
    volverHref, volverLabel,
  } = props;
  const vencida = estado === "Vencida";
  const esBorradorSinFolio = (numero ?? "").startsWith("BORRADOR-");
  const estadoVisual = deriveFacturaBadgeEstado(estado, acuseCancelacionStatus, cancellationStatus);
  const mostrarSaldo = typeof saldo === "number" && saldo > 0.005 && estado !== "Cancelada";
  return (
    <DetailHeader
      backTo={volverHref}
      backLabel={volverLabel ?? "Volver a Facturación"}
      icon={<Receipt className="h-6 w-6 text-accent shrink-0" />}
      title={
        <span className="font-mono tabular-nums">
          {esBorradorSinFolio
            ? <span className="text-muted-foreground italic font-sans">Sin folio (borrador)</span>
            : numero}
        </span>
      }
      badge={
        <>
          <StatusBadge domain="factura" status={estadoVisual} />
          {sinTimbrar && <Badge variant="outline" className="text-xs">Sin timbrar</Badge>}
          <AmbienteBadge ambiente={ambiente} size="md" />
          {vencida && <AlertTriangle className="h-4 w-4 text-destructive" />}
        </>
      }
      subtitle={
        <span className="flex items-center gap-x-2 flex-wrap">
          <span>
            Exp:{" "}
            {embarqueId ? (
              <Link to={`/embarques/${embarqueId}`} className="font-mono text-accent hover:underline">
                {expediente}
              </Link>
            ) : (
              <span className="font-mono">{expediente}</span>
            )}
          </span>
          {proformaNumero && (
            <>
              <span aria-hidden>•</span>
              <span>
                Proforma:{" "}
                {proformaId ? (
                  <Link to={`/proformas/${proformaId}`} className="font-mono text-accent hover:underline">
                    {proformaNumero}
                  </Link>
                ) : (
                  <span className="font-mono">{proformaNumero}</span>
                )}
              </span>
            </>
          )}
        </span>
      }
      trailing={
        <div className="text-right shrink-0">
          <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(total, moneda)}
          </p>
          {mostrarSaldo && (
            <p className="text-xs tabular-nums text-destructive mt-0.5">
              Saldo: {formatCurrency(saldo!, moneda)}
            </p>
          )}
        </div>
      }
    />
  );
}

