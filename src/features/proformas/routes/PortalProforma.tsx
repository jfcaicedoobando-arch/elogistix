/**
 * Portal público de proformas: `/portal/proformas/:token`.
 * Sin autenticación. Permite al cliente aceptar o rechazar la proforma.
 */
import { useParams } from "react-router-dom";
import { CheckCircle2, Clock, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Seo } from "@/components/shared/Seo";
import { DetailHeader } from "@/components/shared/DetailHeader";

import { usePortalProforma } from "@/features/proformas/hooks/usePortalProforma";
import { PortalProformaResumen } from "@/features/proformas/components/portal/PortalProformaResumen";
import { PortalProformaAcciones } from "@/features/proformas/components/portal/PortalProformaAcciones";

import { formatFechaHora } from "@/lib/formatters";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { AvisoAccionable } from "@/components/shared/states/AvisoAccionable";
import { COPY_ENLACE, COPY_PASOS } from "@/lib/copy/publicoCopy";

function fechaMx(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = formatFechaHora(iso, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return s === "-" ? "—" : s;
}

type PortalState = ReturnType<typeof usePortalProforma>;

function ContenidoPortal({ state }: { state: PortalState }) {
  const { loading, error, data, submitting, responder } = state;

  if (loading) {
    return <LoadingState label="Cargando proforma…" />;
  }

  if (error || data?.estado_link === "token_invalido") {
    return (
      <AvisoAccionable
        tono="error"
        icon={<AlertTriangle className="h-5 w-5" />}
        titulo="No pudimos abrir esta proforma"
        descripcion={COPY_ENLACE.invalido}
        pasos={COPY_PASOS.enlaceInvalido}
      />
    );
  }

  if (data?.proforma && data.estado_link === "expirado") {
    return (
      <AvisoAccionable
        icon={<Clock className="h-5 w-5" />}
        titulo="Este enlace ya venció"
        descripcion={`El enlace de tu proforma venció el ${fechaMx(data.proforma.token_expira_at)}.`}
        pasos={COPY_PASOS.enlaceVencido}
      />
    );
  }

  // RUX-10: estado no contemplado por la edge (data sin proforma, estado_link
  // desconocido) — nunca pantalla en blanco; patrón AvisoAccionable (v13.534).
  if (!data?.proforma) {
    return (
      <AvisoAccionable
        tono="error"
        icon={<AlertTriangle className="h-5 w-5" />}
        titulo="No pudimos cargar esta proforma"
        descripcion={COPY_ENLACE.noDisponible}
        pasos={COPY_PASOS.servicioNoDisponible}
      />
    );
  }

  // BL-11: con el link no vigente el backend ya no devuelve montos, conceptos
  // ni datos del cliente; se muestra sólo el estado del enlace.
  if (data.estado_link === "respondida") {
    return (
      <AvisoAccionable
        icon={<CheckCircle2 className="h-5 w-5" />}
        titulo="Esta proforma ya fue respondida"
        descripcion={`La proforma ${data.proforma.numero ?? ""} ya registró una respuesta. Si necesitas revisarla de nuevo, solicita un nuevo enlace.`}
        pasos={COPY_PASOS.enlaceInvalido}
      />
    );
  }

  return (
    <>
      <PortalProformaResumen proforma={data.proforma} conceptos={data.conceptos} />
      {data.estado_link === "activo" && (
        <PortalProformaAcciones submitting={submitting} onResponder={responder} error={null} />
      )}
    </>
  );
}

export default function PortalProforma() {
  const { token } = useParams<{ token: string }>();
  const state = usePortalProforma(token);

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <Seo title="Proforma para revisión — Libre Carga" description="Portal de aprobación de proformas" noIndex />
      <div className="max-w-2xl mx-auto space-y-4">
        <DetailHeader
          backTo={null}
          icon={<FileSpreadsheet className="h-5 w-5 text-primary" />}
          title="Portal de proformas"
          subtitle="Revisa el detalle y responde tu proforma de Libre Carga."
        />


        <ContenidoPortal state={state} />

        <p className="text-xs text-muted-foreground text-center pt-4">
          © Libre Carga — Este enlace es único para tu proforma y expira por seguridad.
        </p>
      </div>
    </div>
  );
}
