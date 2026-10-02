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
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import { SolicitudPricingCampos, type DatosSolicitud } from "./SolicitudPricingCampos";

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

/** Mismo criterio que la RPC de envío: servicio + origen/POL + destino/POD. */
export function solicitudCompleta(d: DatosSolicitud): boolean {
  return !!d.servicio && !!(d.origen?.trim() || d.pol?.trim()) && !!(d.destino?.trim() || d.pod?.trim());
}

export function SolicitudPricingDialog({ open, onOpenChange, oportunidadId, clienteNombre, solicitud }: Props) {
  const { user } = useAuth();
  const { organizationId } = useOrgActiva();
  const guardar = useGuardarSolicitud();
  const [datos, setDatos] = useState<DatosSolicitud>(() => inicial(user?.id ?? "", clienteNombre, solicitud));
  const [sucio, setSucio] = useState(false);

  useEffect(() => {
    if (open) { setDatos(inicial(user?.id ?? "", clienteNombre, solicitud)); setSucio(false); }
  }, [open, user?.id, clienteNombre, solicitud]);

  const set = <K extends keyof DatosSolicitud>(campo: K, valor: DatosSolicitud[K]) => {
    setDatos((p) => ({ ...p, [campo]: valor }));
    setSucio(true);
  };

  const ejecutar = (enviar: boolean) => {
    if (!organizationId || guardar.isPending) return;
    guardar.mutate(
      { id: solicitud?.id, enviar, datos: { ...datos, organization_id: organizationId, oportunidad_id: oportunidadId, folio: "" } },
      { onSuccess: () => onOpenChange(false) },
    );
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
    </FormDialogShell>
  );
}
