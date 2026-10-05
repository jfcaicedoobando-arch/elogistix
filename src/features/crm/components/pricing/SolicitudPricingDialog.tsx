/**
 * Alta/edición de una Solicitud a Pricing desde la oportunidad.
 * "Guardar borrador" o "Enviar a Pricing" (arranca el reloj y avisa a Pricing).
 */
import { useEffect, useState, type FormEvent } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { hoyMx } from "@/lib/date/mx";
import { useGuardarSolicitud } from "@/features/crm/hooks/usePricingCrm";
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

export function SolicitudPricingDialog({ open, onOpenChange, oportunidadId, clienteNombre, solicitud }: Props) {
  const { user } = useAuth();
  const { organizationId } = useOrgActiva();
  const guardar = useGuardarSolicitud();
  const [datos, setDatos] = useState<DatosSolicitud>(() => inicial(user?.id ?? "", clienteNombre, solicitud));
  const [sucio, setSucio] = useState(false);
  const [pendientes, setPendientes] = useState<File[]>([]);

  useEffect(() => {
    if (open) { setDatos(inicial(user?.id ?? "", clienteNombre, solicitud)); setSucio(false); setPendientes([]); }
  }, [open, user?.id, clienteNombre, solicitud]);

  const set = <K extends keyof DatosSolicitud>(campo: K, valor: DatosSolicitud[K]) => {
    setDatos((p) => ({ ...p, [campo]: valor }));
    setSucio(true);
  };

  const ejecutar = (enviar: boolean) => {
    if (!organizationId || guardar.isPending) return;
    guardar.mutate(
      { id: solicitud?.id, enviar, datos: { ...datos, organization_id: organizationId, oportunidad_id: oportunidadId, folio: "" } },
      { onSuccess: async (id) => { await subirPendientes(organizationId, id); onOpenChange(false); } },
    );
  };
  const subirPendientes = async (orgId: string, id: string) => {
    try {
      for (const f of pendientes) await subirAdjunto(orgId, id, f);
    } catch (e) {
      notifyError(undefined, { title: "La solicitud se guardó, pero un archivo no se adjuntó",
        description: "Ábrela de nuevo y vuelve a adjuntarlo.", error: e, method: "CRM_PRICING_ADJUNTO" });
    }
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); ejecutar(true); };
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
      isDirty={sucio && !guardar.isPending}
      busy={guardar.isPending}
      footer={
        <>
          <Button type="button" variant="outline" disabled={guardar.isPending} onClick={() => ejecutar(false)}>
            Guardar borrador
          </Button>
          <Button type="submit" form={FORM_ID} disabled={!completa || guardar.isPending}
            title={completa ? undefined : "Falta Service, origen (o POL) y destino (o POD)"}>
            {guardar.isPending ? "Guardando…" : "Enviar a Pricing"}
          </Button>
        </>
      }
    >
      <SolicitudPricingCampos datos={datos} set={set} disabled={guardar.isPending} />
      {solicitud && organizationId
        ? <AdjuntosSolicitudPricing organizationId={organizationId} solicitudId={solicitud.id} puedeAdjuntar />
        : <AdjuntosPendientes archivos={pendientes} onChange={(f) => { setPendientes(f); setSucio(true); }} disabled={guardar.isPending} />}
    </FormDialogShell>
  );
}
