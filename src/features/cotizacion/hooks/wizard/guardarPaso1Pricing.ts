import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { identidadPricingCoincide } from "./identidadPricing";

export function firmaCapturaPricing(v: CotizacionFormValues): string {
  return JSON.stringify({ ...v, pricingVinculoPendienteId: null, pricingVinculoPendienteFirma: null }, (_key, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  });
}

export function validarCapturaPricingPendiente(v: CotizacionFormValues): void {
  if (v.pricingVinculoPendienteId && v.pricingVinculoPendienteFirma !== firmaCapturaPricing(v)) {
    throw new Error("La captura cambió después de guardar. Recupera los datos guardados antes de reintentar el vínculo Pricing.");
  }
}

export async function guardarPaso1Pricing(
  form: UseFormReturn<CotizacionFormValues>, cotizacionId: string | null, guardar: () => Promise<string>,
): Promise<string> {
  const v = form.getValues();
  const scope = captureAuthOperationScope();
  const firma = firmaCapturaPricing(v);
  const pricing = !v.esProspecto && Boolean(v.pricingSolicitudId);
  if (pricing && (!identidadPricingCoincide(v) || v.pricingOrigen?.organizationId !== scope.organizationId)) {
    throw new Error("La identidad de Pricing cambió. Vuelve a seleccionar la respuesta.");
  }
  validarCapturaPricingPendiente(v);
  if (v.pricingVinculoPendienteId) {
    if (!pricing || (cotizacionId && cotizacionId !== v.pricingVinculoPendienteId)) {
      throw new Error("Hay un vínculo Pricing pendiente. Recupera la misma cotización antes de continuar.");
    }
    return v.pricingVinculoPendienteId;
  }
  const id = await guardar();
  scope.assertCurrent();
  if (pricing) {
    form.setValue("pricingVinculoPendienteFirma", firma);
    form.setValue("pricingVinculoPendienteId", id, { shouldDirty: true });
  }
  return id;
}
