/**
 * Conteos livianos de las bandejas de trabajo del cockpit de Facturación.
 * Extraído de bandejas.ts para respetar el límite de líneas.
 */
import { supabase } from "@/integrations/supabase/client";
import { FECHA_INICIO_TIMBRADO_SISTEMA } from "@/features/facturacion/domain/facturaFlags";
import { todayLocalISO } from "@/lib/date/today";
import { fetchIdsConEnvioExitoso } from "./bandejasQueries";

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
  const [porTimbrar, timbradas, enviadasIds, porCobrar, vencidas, reps] = await Promise.all([
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("estado", "Borrador")
      .is("facturapi_id", null)
      .is("deleted_at", null)
      .gte("fecha_emision", FECHA_INICIO_TIMBRADO_SISTEMA.slice(0, 10)),
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("uuid_fiscal", "is", null)
      .in("estado", ["Emitida", "Parcialmente pagada", "Pagada"])
      .is("deleted_at", null),
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
  // EC-04: "Por enviar" = timbradas − DISTINCT factura_id con envío exitoso.
  // Contar envíos crudos divergía de la lista cuando una factura se reenvía
  // (existe historial en factura_envios): badge y bandeja se contradecían.
  const porEnviar = Math.max(0, (timbradas.count ?? 0) - enviadasIds.size);
  return {
    porTimbrar: porTimbrar.count ?? 0,
    porEnviar,
    porCobrar: porCobrar.count ?? 0,
    vencidas: vencidas.count ?? 0,
    repPendientes: reps.count ?? 0,
  };
}
