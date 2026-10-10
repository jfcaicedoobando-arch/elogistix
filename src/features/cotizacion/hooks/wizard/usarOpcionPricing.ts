import { captureAuthOperationScope, AuthOperationChangedError } from "@/lib/auth/authOperationScope";
import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { OpcionPricingCotizacion } from "@/features/cotizacion/services/opcionesPricingCotizacion";
import { esEnNegociacion } from "@/features/cotizacion/services/opcionesPricingCotizacion";
import { fetchContextoPricingCotizacion } from "@/features/cotizacion/services/contextoPricingCotizacion";
import { recordarIdentidadPricing } from "./identidadPricing";
import { aplicarRespuestaPricing } from "./aplicarRespuestaPricing";
import { validarIncotermRespuestaPricing } from "@/features/cotizacion/domain/respuestaPricing";

const ultimaSeleccion = new WeakMap<object, object>();

/** Revalida el origen y conserva la captura si cambia mientras responde el servidor. */
export async function usarOpcionPricing(form: UseFormReturn<CotizacionFormValues>, opcion: OpcionPricingCotizacion) {
  if (form.getValues("pricingVinculoPendienteId")) throw new Error("Confirma primero el vínculo Pricing pendiente antes de elegir otra respuesta.");
  const scope = captureAuthOperationScope();
  if (scope.organizationId !== opcion.organizationId) throw new AuthOperationChangedError();
  const token = {};
  ultimaSeleccion.set(form, token);
  const antes = JSON.stringify(form.getValues());
  const clienteId = form.getValues("clienteId");
  const oportunidadId = form.getValues("oportunidadId");
  if (clienteId !== (opcion.clienteId ?? "") || (oportunidadId && oportunidadId !== opcion.oportunidadId)) {
    throw new Error("La respuesta de Pricing ya no corresponde a la empresa u oportunidad seleccionada.");
  }
  const contexto = await fetchContextoPricingCotizacion({ organizationId: opcion.organizationId, solicitudId: opcion.solicitudId, oportunidadId: opcion.oportunidadId, tarifaId: opcion.tarifa.id }).catch((error: unknown) => { scope.assertCurrent(); throw error; });
  scope.assertCurrent();
  if (ultimaSeleccion.get(form) !== token) throw new Error("La selección de Pricing fue reemplazada por otra.");
  if (antes !== JSON.stringify(form.getValues())) throw new Error("La captura cambió mientras se verificaba Pricing. Vuelve a elegir la respuesta.");
  if (contexto.destinatario?.clienteId !== clienteId) throw new Error("La empresa de la oportunidad cambió. Vuelve a cargar las respuestas.");
  if (!esEnNegociacion(contexto.destinatario?.etapaNombre)) throw new Error("La oportunidad ya no está en negociación.");
  validarIncotermRespuestaPricing(contexto.solicitud);
  form.setValue("oportunidadId", opcion.oportunidadId, { shouldDirty: true, shouldValidate: true });
  const moneda = contexto.destinatario.moneda;
  form.setValue("monedaCrm", moneda === "USD" || moneda === "MXN" ? moneda : "", { shouldDirty: true });
  aplicarRespuestaPricing(form, contexto.tarifa, contexto.solicitud);
  recordarIdentidadPricing(form, contexto.solicitud ? opcion.solicitudId : null, opcion.organizationId);
}
