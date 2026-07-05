/**
 * Barra de acciones de la cabecera de FacturaDetalle. Concentra TODAS las
 * acciones fiscales/operativas del CFDI (Timbrar, Descargas, Enviar por
 * email, Ver embarque, Sustituir, Cancelar y Eliminar borrador) para que
 * el usuario tenga un único punto de entrada consistente con la lista de
 * facturación (v13.172.12: acciones sólo viven en el detalle).
 */
import { Link } from "react-router-dom";
import {
  FileText, FileCode2, Ship, Stamp, Mail, Trash2, Loader2, Replace, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  canEdit: boolean;
  sinTimbrar: boolean;
  puedeTimbrarDesdeSistema: boolean;
  puedeSustituirCfdi: boolean;
  puedeCancelarCfdi: boolean;
  pdfUrl: string | null;
  xmlUrl: string | null;
  embarqueId: string | null;
  onTimbrar: () => void;
  onEnviarEmail: () => void;
  onDownload: (stored: string | null, tipo: "pdf" | "xml") => void;
  onSustituir: () => void;
  onCancelar: () => void;
  /** Sólo se pasa cuando la factura es borrador y el usuario puede eliminarla. */
  onEliminarBorrador?: () => void;
  eliminando?: boolean;
}

export function FacturaDetalleActions({
  canEdit, sinTimbrar, puedeTimbrarDesdeSistema,
  puedeSustituirCfdi, puedeCancelarCfdi,
  pdfUrl, xmlUrl, embarqueId,
  onTimbrar, onEnviarEmail, onDownload, onSustituir, onCancelar,
  onEliminarBorrador, eliminando,
}: Props) {
  const mostrarPdf = !!pdfUrl || !sinTimbrar;
  const mostrarXml = !!xmlUrl || !sinTimbrar;
  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && puedeTimbrarDesdeSistema && (
        <Button size="sm" onClick={onTimbrar}>
          <Stamp className="h-4 w-4 mr-1.5" /> Timbrar factura
        </Button>
      )}
      {mostrarPdf && (
        <Button variant="outline" size="sm" onClick={() => onDownload(pdfUrl, "pdf")}>
          <FileText className="h-4 w-4 mr-1.5 text-destructive" /> Descargar PDF
        </Button>
      )}
      {mostrarXml && (
        <Button variant="outline" size="sm" onClick={() => onDownload(xmlUrl, "xml")}>
          <FileCode2 className="h-4 w-4 mr-1.5 text-info" /> Descargar XML
        </Button>
      )}
      {!sinTimbrar && (
        <Button variant="outline" size="sm" onClick={onEnviarEmail}>
          <Mail className="h-4 w-4 mr-1.5" /> Enviar por email
        </Button>
      )}
      {embarqueId && (
        <Button variant="outline" size="sm" asChild>
          <Link to={`/embarques/${embarqueId}`}>
            <Ship className="h-4 w-4 mr-1.5" /> Ver embarque
          </Link>
        </Button>
      )}
      {puedeSustituirCfdi && (
        <Button variant="outline" size="sm" onClick={onSustituir}>
          <Replace className="h-4 w-4 mr-1.5" /> Sustituir CFDI
        </Button>
      )}
      {puedeCancelarCfdi && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCancelar}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Ban className="h-4 w-4 mr-1.5" /> Cancelar CFDI
        </Button>
      )}
      {onEliminarBorrador && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEliminarBorrador}
          disabled={eliminando}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {eliminando
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : <Trash2 className="h-4 w-4 mr-1.5" />}
          Eliminar borrador
        </Button>
      )}
    </div>
  );
}
