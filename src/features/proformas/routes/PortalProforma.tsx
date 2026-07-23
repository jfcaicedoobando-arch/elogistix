/**
 * Portal público de proformas: `/portal/proformas/:token`.
 * Sin autenticación. Permite al cliente aceptar o rechazar la proforma.
 */
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertTriangle, FileSpreadsheet, Loader2 } from "lucide-react";
import { Seo } from "@/components/shared/Seo";
import { usePortalProforma } from "@/features/proformas/hooks/usePortalProforma";
import { PortalProformaResumen } from "@/features/proformas/components/portal/PortalProformaResumen";
import { PortalProformaAcciones } from "@/features/proformas/components/portal/PortalProformaAcciones";

import { formatFechaHora } from "@/lib/formatters";

function fechaMx(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = formatFechaHora(iso, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return s === "-" ? "—" : s;
}

type ProformaData = NonNullable<NonNullable<ReturnType<typeof usePortalProforma>["data"]>["proforma"]>;

function AlertaRespondida({ proforma }: { proforma: ProformaData }) {
  const aceptada = proforma.estado_cliente === "aceptada";
  const descripcion = aceptada
    ? `Aceptada el ${fechaMx(proforma.aceptada_at)}. Gracias por tu confirmación.`
    : `Rechazada el ${fechaMx(proforma.rechazada_at)}.${proforma.motivo_rechazo ? ` Motivo: ${proforma.motivo_rechazo}` : ""}`;
  return (
    <Alert>
      {aceptada ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
      <AlertTitle className="flex items-center gap-2">
        Proforma {proforma.estado_cliente}
        <Badge variant={aceptada ? "default" : "destructive"}>{proforma.estado_cliente}</Badge>
      </AlertTitle>
      <AlertDescription>{descripcion}</AlertDescription>
    </Alert>
  );
}

type PortalState = ReturnType<typeof usePortalProforma>;

function ContenidoPortal({ state }: { state: PortalState }) {
  const { loading, error, data, submitting, responder } = state;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando proforma…
        </CardContent>
      </Card>
    );
  }

  if (error || data?.estado_link === "token_invalido") {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Enlace inválido</AlertTitle>
        <AlertDescription>
          El enlace no es válido o fue revocado. Solicita uno nuevo a tu ejecutivo de cuenta.
        </AlertDescription>
      </Alert>
    );
  }

  if (data?.proforma && data.estado_link === "expirado") {
    return (
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Enlace expirado</AlertTitle>
        <AlertDescription>
          Este enlace expiró el {fechaMx(data.proforma.token_expira_at)}. Solicita uno nuevo a tu ejecutivo.
        </AlertDescription>
      </Alert>
    );
  }

  if (!data?.proforma) return null;

  return (
    <>
      {data.estado_link === "respondida" && <AlertaRespondida proforma={data.proforma} />}
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
      <Seo title="Proforma para revisión — Libre Carga" description="Portal de aprobación de proformas" />
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <FileSpreadsheet className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Libre Carga · Portal de proformas</h1>
        </div>

        <ContenidoPortal state={state} />

        <p className="text-xs text-muted-foreground text-center pt-4">
          © Libre Carga — Este enlace es único para tu proforma y expira por seguridad.
        </p>
      </div>
    </div>
  );
}
