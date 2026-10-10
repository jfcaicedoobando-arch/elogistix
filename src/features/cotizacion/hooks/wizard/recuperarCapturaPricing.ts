import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";
import { COTIZACION_FORM_DEFAULTS, type CotizacionFormValues } from "@/features/cotizacion/types";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { notifyError } from "@/lib/ui/appFeedback";

const identidad = z.object({
  esProspecto: z.literal(false), clienteId: z.string().min(1), oportunidadId: z.string().min(1),
  tarifaId: z.string().min(1), pricingSolicitudId: z.string().min(1),
  pricingOrigen: z.object({ organizationId: z.string().min(1), clienteId: z.string(),
    oportunidadId: z.string(), tarifaId: z.string(), solicitudId: z.string() }),
}).passthrough();

function leerCaptura(firma: string): CotizacionFormValues {
  const p = identidad.parse(JSON.parse(firma));
  const shapeValido = Object.entries(COTIZACION_FORM_DEFAULTS).every(([key, valor]) => {
    if (valor == null) return true;
    return Array.isArray(valor) ? Array.isArray(p[key]) : typeof p[key] === typeof valor;
  });
  if (!shapeValido) throw new Error("La captura guardada está incompleta.");
  const origen = p.pricingOrigen;
  if (p.clienteId !== origen.clienteId || p.oportunidadId !== origen.oportunidadId
    || p.tarifaId !== origen.tarifaId || p.pricingSolicitudId !== origen.solicitudId) {
    throw new Error("El origen de la captura guardada no coincide.");
  }
  // SAFE-CAST: JSON local con shape de campos verificado como en loadDraft;
  // sólo restaura captura. La RPC sigue validando la identidad persistida.
  const values = p as unknown as CotizacionFormValues;
  const fecha = p.validezPropuesta;
  values.validezPropuesta = typeof fecha === "string" ? new Date(fecha) : undefined;
  if (values.validezPropuesta && !Number.isFinite(values.validezPropuesta.getTime())) throw new Error("Fecha de captura inválida.");
  return values;
}

/** Acción explícita: no sobrescribe silenciosamente los cambios posteriores. */
export function accionRecuperarCapturaPricing(form: UseFormReturn<CotizacionFormValues>) {
  const { pricingVinculoPendienteId: id, pricingVinculoPendienteFirma: firma } = form.getValues();
  if (!id || !firma) return undefined;
  const scope = captureAuthOperationScope();
  return { label: "Restaurar captura guardada", onClick: () => {
    try {
      scope.assertCurrent();
      const actual = form.getValues();
      if (actual.pricingVinculoPendienteId !== id || actual.pricingVinculoPendienteFirma !== firma) throw new Error("El vínculo pendiente cambió. Vuelve a intentarlo.");
      const values = leerCaptura(firma);
      if (values.pricingOrigen?.organizationId !== scope.organizationId) throw new Error("La captura pertenece a otra organización.");
      form.reset({ ...values, pricingVinculoPendienteId: id, pricingVinculoPendienteFirma: firma });
    } catch (error) {
      if (scope.isCurrent()) notifyError(undefined, { title: "No se pudo restaurar la captura Pricing", error });
    }
  } };
}
