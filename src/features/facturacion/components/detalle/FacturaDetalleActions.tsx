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
import { Fragment, type ReactNode } from "react";
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

function GrupoCfdi({
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

function GrupoAcuse({
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

function GrupoContexto({
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

function GrupoDestructivo({
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

function computeVisibility(props: Props) {
  const mostrarPdf = !!props.pdfUrl || !props.sinTimbrar;
  const mostrarXml = !!props.xmlUrl || !props.sinTimbrar;
  const mostrarGrupoCfdi = mostrarPdf || mostrarXml;
  const mostrarGrupoAcuse = !!props.estaCancelada && (!!props.acuseDisponible || props.acuseStatus !== "accepted");
  const mostrarEnviarEmail = !props.sinTimbrar && !props.estaCancelada;
  const mostrarGrupoContexto = mostrarEnviarEmail || !!props.embarqueId;
  const mostrarGrupoDestructivo = props.puedeSustituirCfdi || props.puedeCancelarCfdi || !!props.onEliminarBorrador;
  return {
    mostrarPdf, mostrarXml, mostrarGrupoCfdi, mostrarGrupoAcuse,
    mostrarEnviarEmail, mostrarGrupoContexto, mostrarGrupoDestructivo,
  };
}

export function FacturaDetalleActions(props: Props) {
  const v = computeVisibility(props);
  const sections: Array<{ show: boolean; node: ReactNode }> = [
    {
      show: v.mostrarGrupoCfdi,
      node: (
        <GrupoCfdi
          mostrarPdf={v.mostrarPdf} mostrarXml={v.mostrarXml}
          pdfUrl={props.pdfUrl} xmlUrl={props.xmlUrl} onDownload={props.onDownload}
        />
      ),
    },
    {
      show: v.mostrarGrupoAcuse,
      node: (
        <GrupoAcuse
          acuseDisponible={props.acuseDisponible} acuseStatus={props.acuseStatus}
          onDescargarAcuseXml={props.onDescargarAcuseXml}
          onDescargarAcusePdf={props.onDescargarAcusePdf}
          onReintentarAcuse={props.onReintentarAcuse}
          reintentandoAcuse={props.reintentandoAcuse}
        />
      ),
    },
    {
      show: v.mostrarGrupoContexto,
      node: (
        <GrupoContexto
          mostrarEnviarEmail={v.mostrarEnviarEmail}
          embarqueId={props.embarqueId} onEnviarEmail={props.onEnviarEmail}
        />
      ),
    },
    {
      show: v.mostrarGrupoDestructivo,
      node: (
        <GrupoDestructivo
          puedeSustituirCfdi={props.puedeSustituirCfdi}
          puedeCancelarCfdi={props.puedeCancelarCfdi}
          onSustituir={props.onSustituir} onCancelar={props.onCancelar}
          onEliminarBorrador={props.onEliminarBorrador} eliminando={props.eliminando}
        />
      ),
    },
  ];

  let previoVisible = false;
  const renderedSections = sections.filter((s) => s.show).map((s, i) => {
    const needsDivider = previoVisible;
    previoVisible = true;
    return (
      <Fragment key={i}>
        {needsDivider && <Divider />}
        {s.node}
      </Fragment>
    );
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.canEdit && props.puedeTimbrarDesdeSistema && (
        <Button size="sm" onClick={props.onTimbrar}>
          <Stamp className="h-4 w-4 mr-1.5" /> Timbrar factura
        </Button>
      )}
      {renderedSections}
    </div>
  );
}
