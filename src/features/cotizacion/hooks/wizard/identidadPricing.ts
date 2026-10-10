import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

export function identidadPricingCoincide(v: CotizacionFormValues): boolean {
  const p = v.pricingOrigen;
  return Boolean(p && v.pricingSolicitudId === p.solicitudId && !v.esProspecto && v.clienteId === p.clienteId
    && v.oportunidadId === p.oportunidadId && v.tarifaId === p.tarifaId);
}

export function recordarIdentidadPricing(form: UseFormReturn<CotizacionFormValues>, solicitudId: string | null, organizationId: string) {
  const v = form.getValues();
  const aplica = !v.esProspecto && solicitudId && v.clienteId && v.oportunidadId && v.tarifaId;
  form.setValue("pricingOrigen", aplica ? { solicitudId, organizationId, clienteId: v.clienteId, oportunidadId: v.oportunidadId, tarifaId: v.tarifaId! } : null);
  form.setValue("pricingSolicitudId", aplica ? solicitudId : null, { shouldDirty: true });
}

/** Un vínculo pendiente no se descarta: primero se reconcilia el mismo ID. */
export function limpiarIdentidadPricingObsoleta(form: UseFormReturn<CotizacionFormValues>) {
  const v = form.getValues();
  if (v.pricingVinculoPendienteId || !v.pricingSolicitudId || identidadPricingCoincide(v)) return;
  form.setValue("pricingSolicitudId", null, { shouldDirty: true });
  form.setValue("pricingOrigen", null, { shouldDirty: true });
}
