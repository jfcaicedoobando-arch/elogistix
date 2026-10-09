/**
 * Alta/edición de una Solicitud a Pricing desde la oportunidad.
 * "Guardar borrador" o "Enviar a Pricing" (arranca el reloj y avisa a Pricing).
 */
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { hoyMx } from "@/lib/date/mx";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { getSessionCacheGeneration, subscribeSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";
import { ErrorEnvioSolicitudPricing, useGuardarSolicitud } from "@/features/crm/hooks/usePricingCrm";
import { solicitudCompleta, type SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import { subirAdjunto } from "@/features/crm/services/pricing/adjuntosPricing";
import { notifyError } from "@/lib/ui/appFeedback";
import { SolicitudPricingCampos, type DatosSolicitud } from "./SolicitudPricingCampos";
import { AdjuntosSolicitudPricing } from "./AdjuntosSolicitudPricing";
import { AdjuntosPendientes } from "./AdjuntosPendientes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidadId: string;
  clienteNombre?: string | null;
  solicitud?: SolicitudPricingRow | null;
}

const FORM_ID = "solicitud-pricing";

function inicial(userId: string, cliente: string | null | undefined, s?: SolicitudPricingRow | null): DatosSolicitud {
  if (s) {
    const { folio: _f, organization_id: _o, oportunidad_id: _p, ...resto } = s;
    return resto;
  }
  return { solicitante_id: userId, fecha: hoyMx(), cliente: cliente ?? null, complejidad: "media" };
}

export function SolicitudPricingDialog(props: Props) {
  const { user } = useAuth();
  const { organizationId } = useOrgActiva();
  const authGeneration = useSyncExternalStore(subscribeSessionCacheGeneration, getSessionCacheGeneration, getSessionCacheGeneration);
  const solicitud = props.solicitud?.oportunidad_id === props.oportunidadId
    && props.solicitud.organization_id === organizationId ? props.solicitud : null;
  const identidad = JSON.stringify([props.solicitud?.id, props.oportunidadId, organizationId, user?.id, authGeneration]);
  // Cambiar identidad o cerrar desmonta la captura y revoca sus continuaciones.
  return props.open ? <SesionSolicitudPricing key={identidad} {...props} solicitud={solicitud}
    organizationId={organizationId} userId={user?.id} /> : null;
}

function SesionSolicitudPricing({ open, onOpenChange, oportunidadId, clienteNombre, solicitud, organizationId, userId }:
  Props & { organizationId?: string | null; userId?: string }) {
  const guardar = useGuardarSolicitud();
  const [datos, setDatos] = useState<DatosSolicitud>(() => inicial(userId ?? "", clienteNombre, solicitud));
  const [sucio, setSucio] = useState(false);
  const [pendientes, setPendientes] = useState<File[]>([]);
  const idGuardado = useRef(solicitud?.id);
  const generacion = useRef<object | null>(null);
  const enCurso = useRef(false);
  const [procesando, setProcesando] = useState(false);
  const [envioSinConfirmar, setEnvioSinConfirmar] = useState(false);
  const busy = procesando || guardar.isPending;

  useLayoutEffect(() => {
    const token = {};
    generacion.current = token;
    return () => { if (generacion.current === token) generacion.current = null; };
  }, []);

  const set = <K extends keyof DatosSolicitud>(campo: K, valor: DatosSolicitud[K]) => {
    setDatos((p) => ({ ...p, [campo]: valor }));
    setSucio(true);
  };

  const ejecutar = async (enviar: boolean) => {
    const token = generacion.current;
    if (!organizationId || !token || enCurso.current || guardar.isPending) return;
    const scope = captureAuthOperationScope();
    const vigente = () => generacion.current === token && scope.isCurrent();
    enCurso.current = true;
    setProcesando(true);
    try {
      const id = await guardar.mutateAsync(
        { id: idGuardado.current, enviar, vigente, datos: { ...datos, organization_id: organizationId, oportunidad_id: oportunidadId, folio: "" } },
      );
      if (!vigente()) return;
      idGuardado.current = id;
      setEnvioSinConfirmar(false);
      await subirPendientes(organizationId, id, vigente);
      if (!vigente()) return;
      setSucio(false);
      onOpenChange(false);
    } catch (error) {
      if (!vigente()) return;
      if (error instanceof ErrorEnvioSolicitudPricing) {
        idGuardado.current = error.solicitudId;
        setEnvioSinConfirmar(true);
        // Los datos ya se guardaron; los archivos aún no se han subido.
        setSucio(pendientes.length > 0);
      }
      // El hook muestra el error de guardado o de envío.
    } finally {
      if (vigente()) {
        enCurso.current = false;
        setProcesando(false);
      }
    }
  };
  const subirPendientes = async (orgId: string, id: string, vigente: () => boolean) => {
    try {
      for (const f of pendientes) {
        if (!vigente()) return;
        await subirAdjunto(orgId, id, f);
      }
    } catch (e) {
      if (!vigente()) return;
      notifyError(undefined, { title: "La solicitud se guardó, pero un archivo no se adjuntó",
        description: "Ábrela de nuevo y vuelve a adjuntarlo.", error: e, method: "CRM_PRICING_ADJUNTO" });
    }
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); void ejecutar(true); };
  const completa = solicitudCompleta(datos);

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Calculator}
      title={solicitud ? `Solicitud ${solicitud.folio}` : "Nueva solicitud a Pricing"}
      description="El folio se asigna solo al guardar."
      size="lg"
      formId={FORM_ID}
      onSubmit={onSubmit}
      isDirty={sucio && !busy}
      busy={busy}
      stickyTop={envioSinConfirmar && <p role="status" className="text-body-sm">
        La solicitud se guardó, pero no se confirmó el envío a Pricing. Puedes reintentar Enviar o guardar el borrador; se reutilizará la misma solicitud.
      </p>}
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={() => { void ejecutar(false); }}>
            Guardar borrador
          </Button>
          <Button type="submit" form={FORM_ID} disabled={!completa || busy}
            title={completa ? undefined : "Falta Service, origen (o POL) y destino (o POD)"}>
            {busy ? "Guardando…" : "Enviar a Pricing"}
          </Button>
        </>
      }
    >
      <SolicitudPricingCampos datos={datos} set={set} disabled={busy} />
      {solicitud && organizationId
        ? <AdjuntosSolicitudPricing organizationId={organizationId} solicitudId={solicitud.id} puedeAdjuntar />
        : <AdjuntosPendientes archivos={pendientes} onChange={(f) => { setPendientes(f); setSucio(true); }} disabled={busy} />}
    </FormDialogShell>
  );
}
