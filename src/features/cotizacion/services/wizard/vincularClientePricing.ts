import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

const respuestaSchema = z.object({
  oportunidad_id: z.string().min(1), cliente_id: z.string().min(1),
  solicitud_id: z.string().min(1), tarifa_id: z.string().min(1),
  updated_at: z.string().min(1).refine((v) => Number.isFinite(Date.parse(v))),
  ya_ligada: z.boolean(),
});

/** Caller preparado localmente; requiere la migración y ACL revisadas antes de publicar. */
export async function vincularClientePricing(cotizacionId: string, v: CotizacionFormValues) {
  const scope = captureAuthOperationScope();
  const p = v.pricingOrigen;
  if (!p || !v.pricingSolicitudId || v.pricingSolicitudId !== p.solicitudId || v.esProspecto || !cotizacionId
    || scope.organizationId !== p.organizationId || v.clienteId !== p.clienteId
    || v.oportunidadId !== p.oportunidadId || v.tarifaId !== p.tarifaId) {
    throw new Error("La identidad de Pricing cambió. Revisa la empresa, oportunidad y respuesta seleccionadas.");
  }
  scope.assertCurrent();
  const { data, error } = await supabase.rpc("crm_vincular_cotizacion_cliente_pricing", {
    p_cotizacion_id: cotizacionId, p_oportunidad_id: p.oportunidadId,
    p_solicitud_id: v.pricingSolicitudId, p_tarifa_id: p.tarifaId,
  }).then((result) => { scope.assertCurrent(); return result; }, (error: unknown) => { scope.assertCurrent(); throw error; });
  if (error) throw error;
  const result = respuestaSchema.parse(data);
  if (result.oportunidad_id !== p.oportunidadId || result.cliente_id !== p.clienteId
    || result.solicitud_id !== v.pricingSolicitudId || result.tarifa_id !== p.tarifaId) {
    throw new Error("El servidor no confirmó la misma respuesta de Pricing. Reintenta sin crear otra cotización.");
  }
  return result;
}
