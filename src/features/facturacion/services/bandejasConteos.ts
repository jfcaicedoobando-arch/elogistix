/**
 * Conteos livianos de las bandejas de trabajo del cockpit de Facturación.
 * Extraído de bandejas.ts para respetar el límite de líneas.
 */
import { supabase } from "@/integrations/supabase/client";
import { FECHA_INICIO_TIMBRADO_SISTEMA } from "@/features/facturacion/domain/facturaFlags";
import { todayLocalISO } from "@/lib/date/today";
import { fetchIdsConEnvioExitoso, fetchIdsFacturasTimbradas } from "./bandejasQueries";

export interface BandejaConteos {
  porTimbrar: number;
  porEnviar: number;
  porCobrar: number;
  vencidas: number;
  repPendientes: number;
}

/**
 * Conteos livianos con `head: true` (no trae filas, sólo el `count`).
 * "Por facturar" (hueco) no se cuenta aquí: se lee del hook
 * `useHuecoFacturacion` que ya calcula su total.
 */
export async function fetchBandejaConteos(orgId: string): Promise<BandejaConteos> {
  const hoy = todayLocalISO();
  const [porTimbrar, idsTimbradas, enviadasIds, porCobrar, vencidas, reps] = await Promise.all([
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("estado", "Borrador")
      .is("facturapi_id", null)
      .is("deleted_at", null)
      .gte("fecha_emision", FECHA_INICIO_TIMBRADO_SISTEMA.slice(0, 10)),
    fetchIdsFacturasTimbradas(orgId),
    fetchIdsConEnvioExitoso(orgId),
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("estado", ["Emitida", "Parcialmente pagada"])
      .is("deleted_at", null)
      // EC-19: facturas sin fecha de vencimiento (import/migración o captura
      // incompleta) no entraban a ninguna cubeta; se cuentan como "por cobrar".
      .or(`fecha_vencimiento.is.null,fecha_vencimiento.gte.${hoy}`),
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("estado", ["Emitida", "Parcialmente pagada"])
      .is("deleted_at", null)
      .lt("fecha_vencimiento", hoy),
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
  // EC-04: "Por enviar" = anti-join real (mismos IDs que la lista) contra el
  // set de DISTINCT factura_id con envío exitoso. Restar counts divergía
  // cuando había envíos de facturas borradas o fuera de la bandeja.
  const porEnviar = idsTimbradas.filter((id) => !enviadasIds.has(id)).length;
  return {
    porTimbrar: porTimbrar.count ?? 0,
    porEnviar,
    porCobrar: porCobrar.count ?? 0,
    vencidas: vencidas.count ?? 0,
    repPendientes: reps.count ?? 0,
  };
}
