/**
 * Servicio: revalidación de tarifa cotización → embarque (Fase 1).
 *
 * Encapsula las 3 RPCs nuevas (`revalidar_tarifa_cotizacion`,
 * `solicitar_reaprobacion_tarifa`, `resolver_reaprobacion_tarifa`) y traduce
 * el JSON crudo de Supabase a tipos de dominio.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ResultadoRevalidacion,
  CambioTarifa,
  SeveridadRevalidacion,
  DecisionTarifa,
} from "@/lib/domain/revalidacionTarifa";

function parseResultado(raw: unknown): ResultadoRevalidacion {
  const r = (raw ?? {}) as Record<string, unknown>;
  const cambiosRaw = Array.isArray(r.cambios) ? r.cambios : [];
  const cambios: CambioTarifa[] = cambiosRaw.map((c) => {
    const x = c as Record<string, unknown>;
    return {
      concepto: String(x.concepto ?? ""),
      moneda: (x.moneda === "MXN" ? "MXN" : "USD") as "USD" | "MXN",
      monto_anterior: Number(x.monto_anterior ?? 0),
      monto_actual: x.monto_actual == null ? null : Number(x.monto_actual),
      delta_abs: x.delta_abs == null ? null : Number(x.delta_abs),
      delta_pct: x.delta_pct == null ? null : Number(x.delta_pct),
      motivo: x.motivo === "eliminado" ? "eliminado" : undefined,
    };
  });
  const severidad = (
    ["sin_cambios", "informativa", "bloqueante"].includes(String(r.severidad))
      ? r.severidad
      : "sin_cambios"
  ) as SeveridadRevalidacion;
  return {
    tarifa_vigente: Boolean(r.tarifa_vigente),
    agente_sin_cupo: Boolean(r.agente_sin_cupo),
    severidad,
    cambios,
    umbral_pct: Number(r.umbral_pct ?? 5),
    max_delta_pct: Number(r.max_delta_pct ?? 0),
    tarifa_id_vigente: (r.tarifa_id_vigente as string | null) ?? null,
    motivo: r.motivo as string | undefined,
  };
}

export async function revalidarTarifa(cotizacionId: string): Promise<ResultadoRevalidacion> {
  // SAFE-CAST: la RPC no está aún en los tipos generados — el contrato lo valida parseResultado().
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(
    "revalidar_tarifa_cotizacion",
    { p_cotizacion_id: cotizacionId },
  );
  if (error) throw new Error(error.message);
  return parseResultado(data);
}

export async function solicitarReaprobacionVentas(
  cotizacionId: string,
  deltaJsonb: unknown,
): Promise<void> {
  // SAFE-CAST: RPC nueva, validada por el handler de error.
  const { error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)(
    "solicitar_reaprobacion_tarifa",
    { p_cotizacion_id: cotizacionId, p_delta_jsonb: deltaJsonb },
  );
  if (error) throw new Error(error.message);
}

export async function resolverReaprobacion(
  cotizacionId: string,
  decision: "reaprobada" | "rechazada",
): Promise<void> {
  // SAFE-CAST: RPC nueva.
  const { error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)(
    "resolver_reaprobacion_tarifa",
    { p_cotizacion_id: cotizacionId, p_decision: decision },
  );
  if (error) throw new Error(error.message);
}

/**
 * Crea el embarque borrador con la decisión tomada (sin_cambios | refrescada |
 * mantenida_por_operaciones | reaprobada_ventas | sustituida).
 */
export async function crearEmbarqueBorradorConDecision(
  cotizacionId: string,
  decision: DecisionTarifa,
  tarifaIdAplicada: string | null,
  deltaJsonb: unknown,
): Promise<string> {
  // SAFE-CAST: nueva sobrecarga de la RPC con 4 args.
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(
    "crear_embarque_borrador_desde_cotizacion",
    {
      p_cotizacion_id: cotizacionId,
      p_decision: decision,
      p_tarifa_id_aplicada: tarifaIdAplicada,
      p_delta_jsonb: deltaJsonb,
    },
  );
  if (error) throw new Error(error.message);
  if (!data) throw new Error("La función no devolvió un embarque");
  return data as string;
}
