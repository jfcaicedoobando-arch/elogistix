/**
 * Subcomponentes visuales usados por `FacturaDetalleActions`. Se extraen a
 * este archivo para mantener la barra principal < 200 líneas (Power of 10).
 */
import {
  FileText, FileCode2, Ship, Mail, Trash2, Loader2, Replace, Ban,
  FileArchive, RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function Divider() {
  return <div className="mx-1 h-6 w-px self-center bg-border" aria-hidden />;
}

export function GrupoCfdi({
  mostrarPdf, mostrarXml, pdfUrl, xmlUrl, onDownload,
}: {
  mostrarPdf: boolean; mostrarXml: boolean;
  pdfUrl: string | null; xmlUrl: string | null;
  onDownload: (stored: string | null, tipo: "pdf" | "xml") => void;
}) {
  return (
    <>
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
    </>
  );
}

export function GrupoAcuse({
  acuseDisponible, acuseStatus,
  onDescargarAcuseXml, onDescargarAcusePdf, onReintentarAcuse, reintentandoAcuse,
}: {
  acuseDisponible?: boolean; acuseStatus?: string | null;
  onDescargarAcuseXml?: () => void; onDescargarAcusePdf?: () => void;
  onReintentarAcuse?: () => void; reintentandoAcuse?: boolean;
}) {
  return (
    <>
      {acuseDisponible && onDescargarAcuseXml && (
        <Button variant="outline" size="sm" onClick={onDescargarAcuseXml}>
          <FileCode2 className="h-4 w-4 mr-1.5 text-info" /> Acuse XML
        </Button>
      )}
      {acuseDisponible && onDescargarAcusePdf && (
        <Button variant="outline" size="sm" onClick={onDescargarAcusePdf}>
          <FileArchive className="h-4 w-4 mr-1.5 text-destructive" /> Acuse PDF
        </Button>
      )}
      {acuseStatus !== "accepted" && onReintentarAcuse && (
        <Button variant="outline" size="sm" onClick={onReintentarAcuse} disabled={reintentandoAcuse}>
          {reintentandoAcuse
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : <RefreshCw className="h-4 w-4 mr-1.5" />}
          Reintentar acuse
        </Button>
      )}
    </>
  );
}

export function GrupoContexto({
  mostrarEnviarEmail, embarqueId, onEnviarEmail,
}: {
  mostrarEnviarEmail: boolean; embarqueId: string | null; onEnviarEmail: () => void;
}) {
  return (
    <>
      {mostrarEnviarEmail && (
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
    </>
  );
}

export function GrupoDestructivo({
  puedeSustituirCfdi, puedeCancelarCfdi,
  onSustituir, onCancelar, onEliminarBorrador, eliminando,
}: {
  puedeSustituirCfdi: boolean; puedeCancelarCfdi: boolean;
  onSustituir: () => void; onCancelar: () => void;
  onEliminarBorrador?: () => void; eliminando?: boolean;
}) {
  return (
    <>
      {puedeSustituirCfdi && (
        <Button variant="outline" size="sm" onClick={onSustituir}>
          <Replace className="h-4 w-4 mr-1.5" /> Sustituir CFDI
        </Button>
      )}
      {puedeCancelarCfdi && (
        <Button
          variant="outline" size="sm" onClick={onCancelar}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Ban className="h-4 w-4 mr-1.5" /> Cancelar CFDI
        </Button>
      )}
      {onEliminarBorrador && (
        <Button
          variant="outline" size="sm" onClick={onEliminarBorrador} disabled={eliminando}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {eliminando
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : <Trash2 className="h-4 w-4 mr-1.5" />}
          Eliminar borrador
        </Button>
      )}
    </>
  );
}
