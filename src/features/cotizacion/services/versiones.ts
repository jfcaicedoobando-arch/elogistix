/**
 * Servicio de versiones y duplicación de cotizaciones — aísla el I/O contra
 * Supabase para cumplir la jerarquía Pages → Hooks → Services → Lib.
 * (Extraído de `hooks/useCotizacionVersiones.ts` en v13.297.4.)
 *
 * Las llamadas usan `as never` porque la RPC `duplicar_cotizacion` y la tabla
 * `cotizacion_versiones` aún no están reflejadas en los tipos generados.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface CotizacionVersionRow {
  id: string;
  cotizacion_id: string;
  organization_id: string;
  version_num: number;
  folio: string;
  estado_al_snapshot: string;
  snapshot: Record<string, unknown>;
  costos_snapshot: Array<Record<string, unknown>>;
  created_by: string | null;
  created_at: string;
}

export async function duplicarCotizacionRpc(cotizacionId: string): Promise<string> {
  // SAFE-CAST: RPC registrada en BD pero aún no incluida en los tipos generados.
  const { data, error } = await supabase.rpc(
    "duplicar_cotizacion" as never,
    { p_id: cotizacionId } as never,
  );
  if (error) throw new Error(error.message);
  // SAFE-CAST: la RPC devuelve el uuid de la nueva cotización.
  const nuevaId = data as unknown as string;
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "Duplicó cotización (nueva versión)",
    entidadId: nuevaId,
    detalles: { cotizacion_origen_id: cotizacionId },
  });
  return nuevaId;
}

export async function fetchVersiones(cotizacionId: string): Promise<CotizacionVersionRow[]> {
  const { data, error } = await supabase
    // SAFE-CAST: tabla nueva; tipos aún no incluidos hasta regeneración.
    .from("cotizacion_versiones" as never)
    .select(
      "id, cotizacion_id, organization_id, version_num, folio, estado_al_snapshot, snapshot, costos_snapshot, created_by, created_at",
    )
    .eq("cotizacion_id", cotizacionId)
    .order("version_num", { ascending: false });
  if (error) throw new Error(error.message);
  // SAFE-CAST: mapeo directo de la tabla `cotizacion_versiones`.
  return (data ?? []) as unknown as CotizacionVersionRow[];
}
