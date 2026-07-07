/**
 * Barra de acciones de la cabecera de FacturaDetalle. Concentra TODAS las
 * acciones fiscales/operativas del CFDI. Los grupos visuales viven en
 * `FacturaDetalleActionGroups.tsx` para respetar el límite de 200 líneas.
 */
import { Fragment, type ReactNode } from "react";
import { Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Divider, GrupoCfdi, GrupoAcuse, GrupoContexto, GrupoDestructivo,
} from "./FacturaDetalleActionGroups";

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
  onEliminarBorrador?: () => void;
  eliminando?: boolean;
  estaCancelada?: boolean;
  acuseDisponible?: boolean;
  acuseStatus?: string | null;
  onDescargarAcuseXml?: () => void;
  onDescargarAcusePdf?: () => void;
  onReintentarAcuse?: () => void;
  reintentandoAcuse?: boolean;
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
