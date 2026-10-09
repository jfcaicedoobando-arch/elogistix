/**
 * Conteos livianos de las bandejas de trabajo del cockpit de Facturación.
 * Extraído de bandejas.ts para respetar el límite de líneas.
 *
 * v13.823.232: se retiró el conteo "Por enviar" junto con su bandeja;
 * esto elimina 2 queries paginadas que se disparaban en cada visita.
 */
import { supabase } from "@/integrations/supabase/client";
import { FECHA_INICIO_TIMBRADO_SISTEMA } from "@/features/facturacion/domain/facturaFlags";
import { z } from "zod";

export interface BandejaConteos {
  porTimbrar: number;
  porCobrar: number;
  vencidas: number;
  repPendientes: number;
}

/**
 * Conteos livianos. Vencidas usa el saldo neto del canon de Cobranza,
 * sin cargar ni truncar filas para contar.
 * "Por facturar" (hueco) no se cuenta aquí: se lee del hook
 * `useHuecoFacturacion` que ya calcula su total.
 */
export async function fetchBandejaConteos(orgId: string): Promise<BandejaConteos> {
  const [porTimbrar, porCobrar, vencidas, reps] = await Promise.all([
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("estado", "Borrador")
      .is("facturapi_id", null)
      .is("deleted_at", null)
      .gte("fecha_emision", FECHA_INICIO_TIMBRADO_SISTEMA.slice(0, 10)),
    supabase.rpc("cobranza_conteo_por_cobrar", { p_organization_id: orgId }),
    supabase.rpc("cobranza_conteo_vencidas", { p_organization_id: orgId }),
    supabase
      .from("pagos_factura")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("estado_rep", ["Pendiente", "Error"])
      .is("deleted_at", null),
  ]);
  // Fail-closed: un error en cualquier cubeta debe pintar error/reintento en
  // el cockpit, nunca un badge parcial (antes `count ?? 0` lo silenciaba).
  for (const res of [porTimbrar, porCobrar, vencidas, reps]) {
    if (res.error) throw res.error;
  }
  return {
    porTimbrar: porTimbrar.count ?? 0,
    porCobrar: z.number().int().nonnegative().parse(porCobrar.data),
    vencidas: z.number().int().nonnegative().parse(vencidas.data),
    repPendientes: reps.count ?? 0,
  };
}
