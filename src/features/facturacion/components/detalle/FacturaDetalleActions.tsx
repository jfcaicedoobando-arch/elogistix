/**
 * Barra de acciones de la cabecera de FacturaDetalle. Concentra TODAS las
 * acciones fiscales/operativas del CFDI. Los botones se agrupan visualmente
 * con separadores verticales según su naturaleza:
 *   1. Timbrado (sólo borrador).
 *   2. Documentos del CFDI original — Descargar PDF/XML.
 *   3. Acuse SAT — sólo cuando la factura está cancelada.
 *   4. Contexto — Ver embarque, Enviar por email (oculto si cancelada).
 *   5. Acciones destructivas al final — Sustituir, Cancelar, Eliminar.
 */
import { Link } from "react-router-dom";
import {
  FileText, FileCode2, Ship, Stamp, Mail, Trash2, Loader2, Replace, Ban,
  FileArchive, RefreshCw,
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
  /** Bloque de acuse — sólo se renderiza si la factura está cancelada. */
  estaCancelada?: boolean;
  acuseDisponible?: boolean;
  acuseStatus?: string | null;
  onDescargarAcuseXml?: () => void;
  onDescargarAcusePdf?: () => void;
  onReintentarAcuse?: () => void;
  reintentandoAcuse?: boolean;
}

/** Separador vertical sutil entre grupos de botones. */
function Divider() {
  return <div className="mx-1 h-6 w-px self-center bg-border" aria-hidden />;
}

export function FacturaDetalleActions({
  canEdit, sinTimbrar, puedeTimbrarDesdeSistema,
  puedeSustituirCfdi, puedeCancelarCfdi,
  pdfUrl, xmlUrl, embarqueId,
  onTimbrar, onEnviarEmail, onDownload, onSustituir, onCancelar,
  onEliminarBorrador, eliminando,
  estaCancelada, acuseDisponible, acuseStatus,
  onDescargarAcuseXml, onDescargarAcusePdf, onReintentarAcuse, reintentandoAcuse,
}: Props) {
  const mostrarPdf = !!pdfUrl || !sinTimbrar;
  const mostrarXml = !!xmlUrl || !sinTimbrar;
  const mostrarGrupoCfdi = mostrarPdf || mostrarXml;
  const mostrarGrupoAcuse = !!estaCancelada && (acuseDisponible || acuseStatus !== "accepted");
  const mostrarEnviarEmail = !sinTimbrar && !estaCancelada;
  const mostrarGrupoContexto = mostrarEnviarEmail || !!embarqueId;
  const mostrarGrupoDestructivo = puedeSustituirCfdi || puedeCancelarCfdi || !!onEliminarBorrador;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && puedeTimbrarDesdeSistema && (
        <Button size="sm" onClick={onTimbrar}>
          <Stamp className="h-4 w-4 mr-1.5" /> Timbrar factura
        </Button>
      )}

      {/* Grupo 2 — Documentos del CFDI original */}
      {mostrarGrupoCfdi && (
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
      )}

      {/* Grupo 3 — Acuse SAT (sólo cuando la factura está cancelada) */}
      {mostrarGrupoAcuse && (
        <>
          {mostrarGrupoCfdi && <Divider />}
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
            <Button
              variant="outline"
              size="sm"
              onClick={onReintentarAcuse}
              disabled={reintentandoAcuse}
            >
              {reintentandoAcuse
                ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                : <RefreshCw className="h-4 w-4 mr-1.5" />}
              Reintentar acuse
            </Button>
          )}
        </>
      )}

      {/* Grupo 4 — Contexto */}
      {mostrarGrupoContexto && (
        <>
          {(mostrarGrupoCfdi || mostrarGrupoAcuse) && <Divider />}
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
      )}

      {/* Grupo 5 — Acciones destructivas */}
      {mostrarGrupoDestructivo && (
        <>
          {(mostrarGrupoCfdi || mostrarGrupoAcuse || mostrarGrupoContexto) && <Divider />}
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
        </>
      )}
    </div>
  );
}
