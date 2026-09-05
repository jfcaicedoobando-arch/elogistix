/**
 * Header de la vista de detalle de proforma. Usa el componente canónico
 * `DetailHeader` (v13.320.66): botón Volver + número + badges de estado +
 * total destacado como acción trailing.
 */
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { FileText } from "lucide-react";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { useVolver } from "@/hooks/shared/useVolver";
import { EstadoBadges } from "@/features/proformas/components/ProformaDetalleCards";
import { DocumentoStatusStepper } from "@/components/shared/documento/DocumentoStatusStepper";
import { resumenProforma } from "@/lib/domain/documentoEstados";
import type { EstadoClienteProforma } from "@/features/proformas/domain/proformaClienteEstado";
import type { FacturaCicloLite } from "@/lib/domain/etiquetaCicloProforma";

interface Props {
  numero: string;
  estadoProforma: string;
  estadoCliente: EstadoClienteProforma;
  aceptadaPor: string | null;
  /** B9: facturas generadas desde la proforma (borrador vs emitida). */
  facturas?: FacturaCicloLite[];
  clienteNombre: string | null | undefined;
  expediente: string;
  /** Embarque vinculado: habilita el enlace y el fallback de folio. */
  embarqueId?: string | null;
  /** Fecha de envío al cliente (para el paso "Enviada" del stepper). */
  enviadaAt?: string | null;
  /** true cuando la proforma ya está facturada. */
  facturada: boolean;
  /** Barra de acciones, renderizada dentro del encabezado (ola 3). */
  actions?: ReactNode;
}

export function ProformaDetalleHeader({
  numero,
  estadoProforma,
  estadoCliente,
  aceptadaPor,
  facturas,
  clienteNombre,
  expediente,
  embarqueId,
  enviadaAt,
  facturada,
  actions,
}: Props) {
  const volver = useVolver("/proformas");
  const subtitulo = clienteNombre?.trim() || "";
  const resumen = resumenProforma({ estadoCliente, enviadaAt, facturada });
  return (
    <DetailHeader
      backTo={volver}
      backLabel="Volver a Proformas"
      icon={<FileText className="h-6 w-6 text-accent shrink-0" />}
      title={<span className="font-mono tabular-nums">{numero}</span>}
      badge={
        <EstadoBadges
          estadoProforma={estadoProforma}
          estadoCliente={estadoCliente}
          aceptadaPor={aceptadaPor}
          facturas={facturas}
        />
      }
      subtitle={
        <>
          {subtitulo}
          <span className="mx-1.5">•</span>
          Exp:{" "}
          {embarqueId ? (
            <Link to={`/embarques/${embarqueId}`} className="font-mono underline decoration-dotted hover:text-primary">
              {labelExpediente(expediente, embarqueId)}
            </Link>
          ) : (
            <span className="font-mono">{labelExpediente(expediente)}</span>
          )}
        </>
      }
      meta={<DocumentoStatusStepper resumen={resumen} />}
      trailing={actions ? <div className="w-full lg:w-auto">{actions}</div> : undefined}

    />
  );
}

