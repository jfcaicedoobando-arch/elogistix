/**
 * Barra de acciones de la cabecera de FacturaDetalle.
 * Extraído para reducir complejidad ciclomática del componente padre.
 */
import { Link } from "react-router-dom";
import { FileText, FileCode2, Ship, Stamp, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  canEdit: boolean;
  sinTimbrar: boolean;
  pdfUrl: string | null;
  xmlUrl: string | null;
  embarqueId: string | null;
  onTimbrar: () => void;
  onEnviarEmail: () => void;
  onDownload: (stored: string | null, tipo: "pdf" | "xml") => void;
}

export function FacturaDetalleActions({
  canEdit, sinTimbrar, pdfUrl, xmlUrl, embarqueId,
  onTimbrar, onEnviarEmail, onDownload,
}: Props) {
  const mostrarPdf = !!pdfUrl || !sinTimbrar;
  const mostrarXml = !!xmlUrl || !sinTimbrar;
  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && sinTimbrar && (
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
    </div>
  );
}
