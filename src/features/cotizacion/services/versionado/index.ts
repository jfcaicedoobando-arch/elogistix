/**
 * Servicio: versionado de cotizaciones (Fase 2).
 *
 * Encapsula las RPCs `recotizar_cotizacion`, `aceptar_cotizacion_version` y
 * `obtener_costos_cotizacion_version`. La capa Supabase no expone aún estos
 * RPCs en sus tipos generados; usamos un cast `SAFE-CAST` mínimo y validamos
 * el shape en el parseo.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  CotizacionYaAceptadaError,
  MotivoRequeridoError,
} from "@/features/cotizacion/domain/versionadoCotizacion";

export interface CostoVersionado {
  id: string;
  cotizacion_id: string;
  version: number | null;
  concepto: string;
  proveedor: string;
  moneda: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
  precio_venta: number;
  precio_total: number;
}

interface RpcResp<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

type RpcCaller = (fn: string, args: Record<string, unknown>) => Promise<RpcResp>;

function rpc(): RpcCaller {
  // SAFE-CAST: las RPCs nuevas (Fase 2) aún no están en los tipos generados.
  // .bind(supabase) preserva el contexto `this` (de lo contrario el cliente
  // intenta leer `this.rest` y truena con "Cannot read properties of undefined").
  return supabase.rpc.bind(supabase) as unknown as RpcCaller;
}

export async function recotizarCotizacion(
  cotizacionId: string,
  motivo: string,
): Promise<{ version_anterior: number; version_nueva: number }> {
  if (!motivo || !motivo.trim()) throw new MotivoRequeridoError();
  const { data, error } = await rpc()("recotizar_cotizacion", {
    p_cotizacion_id: cotizacionId,
    p_motivo: motivo.trim(),
  });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    version_anterior: Number(d.version_anterior ?? 0),
    version_nueva: Number(d.version_nueva ?? 0),
  };
}

export async function aceptarCotizacionVersion(
  cotizacionId: string,
): Promise<{ version_aceptada: number }> {
  const { data, error } = await rpc()("aceptar_cotizacion_version", {
    p_cotizacion_id: cotizacionId,
  });
  if (error) {
    if (error.code === "22023") throw new CotizacionYaAceptadaError(error.message);
    throw new Error(error.message);
  }
  const d = (data ?? {}) as Record<string, unknown>;
  return { version_aceptada: Number(d.version_aceptada ?? 0) };
}

function parseCosto(raw: unknown): CostoVersionado {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    cotizacion_id: String(r.cotizacion_id ?? ""),
    version: r.version == null ? null : Number(r.version),
    concepto: String(r.concepto ?? ""),
    proveedor: String(r.proveedor ?? ""),
    moneda: String(r.moneda ?? "USD"),
    cantidad: Number(r.cantidad ?? 0),
    costo_unitario: Number(r.costo_unitario ?? 0),
    costo_total: Number(r.costo_total ?? r.costo_unitario ?? 0),
    precio_venta: Number(r.precio_venta ?? 0),
    precio_total: Number(r.precio_total ?? r.precio_venta ?? 0),
  };
}

export async function obtenerCostosCotizacionVersion(
  cotizacionId: string,
  version?: number | null,
): Promise<CostoVersionado[]> {
  const { data, error } = await rpc()("obtener_costos_cotizacion_version", {
    p_cotizacion_id: cotizacionId,
    p_version: version ?? null,
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  return data.map(parseCosto);
}
