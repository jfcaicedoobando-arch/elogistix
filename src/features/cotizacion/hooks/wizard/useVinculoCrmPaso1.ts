import { accionRecuperarCapturaPricing } from "./recuperarCapturaPricing";
import { useCallback, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { vincularClientePricing } from "@/features/cotizacion/services/wizard/vincularClientePricing";
import { validarCapturaPricingPendiente } from "./guardarPaso1Pricing";
import { vincularCrmTrasCrear } from "./handlePaso1Crm";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifyWarning } from "@/lib/ui/appFeedback";
import { avisoBitacoraFallida } from "@/features/crm/services/bitacoraNoBloqueante";

async function confirmarClientePricing(form: UseFormReturn<CotizacionFormValues>, id: string, v: CotizacionFormValues) {
  validarCapturaPricingPendiente(form.getValues());
  const res = await vincularClientePricing(id, v);
  const actual = form.getValues();
  validarCapturaPricingPendiente(actual);
  if (actual.clienteId !== v.clienteId || actual.oportunidadId !== v.oportunidadId
    || actual.tarifaId !== v.tarifaId || actual.pricingSolicitudId !== v.pricingSolicitudId || actual.esProspecto) {
    throw new Error("La captura cambió durante el vínculo. Recupera la respuesta original para reintentar.");
  }
  return res;
}

export function useVinculoCrmPaso1(form: UseFormReturn<CotizacionFormValues>, updateCotizacion: { resincronizarSello?: (sello: string | null) => void }, cotizacionId: string | null = null) {
  // P0: si el vínculo CRM falla, el wizard NO avanza; se conserva la captura y
  // el mismo `cotizacionId` para reintentar sin duplicar nada.
  const [vinculoCrmError, setVinculoCrmError] = useState<string | null>(null);
  // Candado reactivo: al editar una cotización que ya trae oportunidad, y tras
  // el primer vínculo exitoso, el origen/destinatario deja de ser sustituible.
  const [vinculoCrmConfirmado, setVinculoCrmConfirmado] = useState<boolean>(
    () => Boolean(form.getValues("oportunidadId")) && (form.getValues("esProspecto")
      || Boolean(cotizacionId && !form.getValues("pricingVinculoPendienteId"))),
  );

  const limpiarVinculoCrmError = useCallback(() => setVinculoCrmError(null), []);

  /**
   * Vincula la cotización de prospecto a su origen CRM. Devuelve `false` si
   * falló (el wizard debe quedarse en el paso 1).
   */
  const vincularCrm = useCallback(
    async (id: string, v: CotizacionFormValues): Promise<boolean> => {
      if (!v.esProspecto && !v.oportunidadId && !v.pricingSolicitudId) return true;
      const scope = captureAuthOperationScope();
      try {
        if (!v.esProspecto) {
          if (!v.pricingSolicitudId && vinculoCrmConfirmado) return true;
          const res = await confirmarClientePricing(form, id, v);
          updateCotizacion.resincronizarSello?.(res.updated_at);
          form.setValue("pricingVinculoPendienteId", null, { shouldDirty: false });
          form.setValue("pricingVinculoPendienteFirma", null, { shouldDirty: false });
          setVinculoCrmError(null);
          setVinculoCrmConfirmado(true);
          return true;
        }
        const res = await vincularCrmTrasCrear(id, v);
        // Los IDs canónicos son los que devuelve la RPC (no lo capturado).
        const opts = { shouldDirty: false, shouldValidate: true } as const;
        form.setValue("oportunidadId", res.oportunidadId ?? "", opts);
        form.setValue("leadId", res.leadId ?? "", { shouldDirty: false });
        updateCotizacion.resincronizarSello?.(res.updatedAt);
        setVinculoCrmError(null);
        setVinculoCrmConfirmado(true);
        // El vínculo persistió; sólo la bitácora quedó pendiente.
        if (res.avisoActividad) {
          notifyWarning(undefined, {
            title: "Cotización vinculada al CRM",
            description: avisoBitacoraFallida(res.avisoActividad),
          });
        }
        return true;
      } catch (e: unknown) {
        if (!scope.isCurrent()) return false;
        const msg = getErrorMessage(e);
        setVinculoCrmError(msg);
        notifyError(undefined, {
          title: "Cotización guardada, pero falta el vínculo con el CRM",
          action: accionRecuperarCapturaPricing(form),
          description: msg,
          error: e,
          method: "VINCULAR_OPORTUNIDAD_CRM",
          context: { cotizacionId: id, paso: 1 },
        });
        return false;
      }
    },
    [form, updateCotizacion, vinculoCrmConfirmado],
  );

  return { vincularCrm, vinculoCrmError, vinculoCrmConfirmado, limpiarVinculoCrmError };
}
