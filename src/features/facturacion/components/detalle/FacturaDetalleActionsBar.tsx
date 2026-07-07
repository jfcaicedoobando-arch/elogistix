/**
 * FacturaDetalleActionsBar — envuelve `FacturaDetalleActions` derivando sus
 * props a partir de la factura + flags + acuse, para mantener la página
 * `FacturaDetalle` por debajo del límite de 200 líneas (Power of 10).
 */
import { FacturaDetalleActions } from "./FacturaDetalleActions";
import type { useAcuseCancelacion } from "@/features/facturacion/hooks/useAcuseCancelacion";
import type { deriveFacturaFlags } from "@/features/facturacion/domain/facturaFlags";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";

type AcuseHandle = ReturnType<typeof useAcuseCancelacion>;
type Flags = ReturnType<typeof deriveFacturaFlags>;

interface Props {
  factura: FacturaDetalle;
  canEdit: boolean;
  flags: Flags;
  acuse: AcuseHandle;
  eliminando: boolean;
  puedeEliminarBorrador: boolean;
  onTimbrar: () => void;
  onEnviarEmail: () => void;
  onSustituir: () => void;
  onCancelar: () => void;
  onEliminar: () => void;
  onDownload: (stored: string | null, tipo: "pdf" | "xml") => void;
}

export function FacturaDetalleActionsBar({
  factura, canEdit, flags, acuse, eliminando, puedeEliminarBorrador,
  onTimbrar, onEnviarEmail, onSustituir, onCancelar, onEliminar, onDownload,
}: Props) {
  return (
    <FacturaDetalleActions
      canEdit={canEdit}
      sinTimbrar={flags.sinTimbrar}
      puedeTimbrarDesdeSistema={flags.puedeTimbrarDesdeSistema}
      puedeSustituirCfdi={flags.puedeSustituirCfdi}
      puedeCancelarCfdi={flags.puedeCancelarCfdi}
      pdfUrl={factura.factura_pdf_url}
      xmlUrl={factura.factura_xml_url}
      embarqueId={factura.embarque_id ?? null}
      onTimbrar={onTimbrar}
      onEnviarEmail={onEnviarEmail}
      onDownload={onDownload}
      onSustituir={onSustituir}
      onCancelar={onCancelar}
      onEliminarBorrador={puedeEliminarBorrador ? onEliminar : undefined}
      eliminando={eliminando}
      estaCancelada={factura.estado === "Cancelada" || factura.estado === "Sustituida"}
      acuseDisponible={!!factura.acuse_cancelacion_xml}
      acuseStatus={factura.acuse_cancelacion_status}
      onDescargarAcuseXml={acuse.descargarXml}
      onDescargarAcusePdf={acuse.descargarPdf}
      onReintentarAcuse={acuse.reintentar}
      reintentandoAcuse={acuse.reintentando}
    />
  );
}
