/**
 * Encabezado visual de la página FacturaDetalle: título, badges, enlaces
 * de contexto (expediente / proforma) y total con saldo pendiente.
 * v13.308.16: se removió la duplicación del cliente (vive en Receptor)
 * y el expediente pasó a ser link clickable al embarque.
 * v13.320.67: migrado al componente canónico `DetailHeader` (el botón
 * "Volver" ya vive dentro del encabezado, no suelto arriba de la página).
 * v13.320.72 (ola 3): las acciones (`actions`) viajan dentro del slot
 * `trailing`, junto al total, en vez de una barra suelta bajo el encabezado.
 */
import { type ReactNode } from "react";
import { AlertTriangle, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { DocumentoStatusStepper } from "@/components/shared/documento/DocumentoStatusStepper";
import { resumenFacturaEmitida } from "@/lib/domain/documentoEstados";
import { formatDate } from "@/lib/formatters";
import { AmbienteBadge } from "@/features/facturacion/components/AmbienteBadge";
import { deriveFacturaBadgeEstado } from "@/features/facturacion/domain/facturaBadgeEstado";
import { labelExpediente } from "@/lib/domain/labelExpediente";


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
  clienteNombre?: string | null;
  fechaEmision?: string | null;
  ambiente?: "sandbox" | "live" | null;

  volverHref?: string | (() => void);
  volverLabel?: string;
  /** Barra de acciones del detalle, renderizada dentro del encabezado. */
  actions?: ReactNode;
}


export function FacturaDetalleHeader(props: Props) {
  const {
    numero, estado, acuseCancelacionStatus, cancellationStatus, sinTimbrar,
    expediente, embarqueId, proformaId, proformaNumero, clienteNombre, fechaEmision,
    ambiente, volverHref, volverLabel, actions,
  } = props;
  const vencida = estado === "Vencida";
  const esBorradorSinFolio = (numero ?? "").startsWith("BORRADOR-");
  const estadoVisual = deriveFacturaBadgeEstado(estado, acuseCancelacionStatus, cancellationStatus);
  // v13.823.151 — los embarques en borrador aún no tienen expediente; sin la
  // etiqueta de respaldo el enlace quedaba vacío (no se veía nada tras "Exp.:").
  const expedienteLabel = labelExpediente(expediente, embarqueId);

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
          {sinTimbrar && <Badge variant="outline" className="text-body-sm">Sin timbrar</Badge>}
          <AmbienteBadge ambiente={ambiente} size="md" />
          {vencida && <AlertTriangle className="h-4 w-4 text-destructive" />}
        </>
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2">
          {clienteNombre && (
            <>
              <span>{clienteNombre}</span>
              <span aria-hidden>•</span>
            </>
          )}
          {fechaEmision && (
            <>
              <span>Expedida {formatDate(fechaEmision)}</span>
              <span aria-hidden>•</span>
            </>
          )}
          <span>
            Exp.:{" "}
            {embarqueId ? (
              <Link to={`/embarques/${embarqueId}`} className="font-mono text-accent hover:underline">
                {expedienteLabel}
              </Link>
            ) : (
              <span className="font-mono">{expedienteLabel}</span>
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
      meta={<DocumentoStatusStepper resumen={resumenFacturaEmitida(estado)} />}
      trailing={actions ? <div className="w-full lg:w-auto">{actions}</div> : undefined}
    />
  );
}


