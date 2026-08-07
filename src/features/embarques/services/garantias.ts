import { supabase } from "@/integrations/supabase/client";
import type { EstadoGarantia, GarantiaContenedor } from "../types/garantia";
import { mapApiError } from "./garantiasErrors";
import { registrarBitacoraEmbarque } from "./bitacoraEmbarques";

const GARANTIA_COLS =
  "id, embarque_id, embarque_contenedor_id, naviera_id, monto_deposito_usd, tiene_carta_garantia, estado, fecha_deposito, fecha_liberacion, fecha_limite_devolucion, referencia_deposito, notas";

export async function fetchGarantiasEmbarque(embarqueId: string): Promise<GarantiaContenedor[]> {
  const { data, error } = await supabase
    .from("embarque_garantias_contenedor")
    .select(GARANTIA_COLS)
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []) as GarantiaContenedor[];
}

export interface UpdateGarantiaInput {
  id: string;
  estado?: EstadoGarantia;
  fecha_deposito?: string | null;
  fecha_liberacion?: string | null;
  monto_deposito_usd?: number;
  referencia_deposito?: string | null;
  notas?: string | null;
}

/**
 * Actualiza una garantía a través de la RPC `set_garantia_estado` (Fase P.2).
 * El servidor valida rol, transición, congelamiento de monto y fechas requeridas.
 */
export async function updateGarantia(input: UpdateGarantiaInput): Promise<void> {
  // SAFE-CAST: el tipo generado no incluye aún la RPC nueva; el contrato está fijado por la migración v13.301.88.
  const rpc = supabase.rpc as unknown as (
    name: "set_garantia_estado",
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;

  const { error } = await rpc("set_garantia_estado", {
    p_id: input.id,
    p_estado: input.estado ?? null,
    p_fecha_deposito: input.fecha_deposito ?? null,
    p_fecha_liberacion: input.fecha_liberacion ?? null,
    p_monto: input.monto_deposito_usd ?? null,
    p_referencia: input.referencia_deposito ?? null,
    p_notas: input.notas ?? null,
  });
  if (error) throw mapApiError(error);
  await registrarBitacoraEmbarque({
    accion: "Actualizó garantía de contenedor",
    entidadId: input.id,
    detalles: { estado: input.estado, montoDepositoUsd: input.monto_deposito_usd, fechaDeposito: input.fecha_deposito, fechaLiberacion: input.fecha_liberacion },
  });
}

/**
 * Fase v13.303.82 — Repobla garantías `pendiente` de un embarque usando la
 * tarifa aplicada (o, en su defecto, la condición de la naviera por nombre).
 * Devuelve el número de filas actualizadas.
 */
export async function refrescarGarantiasDesdeTarifa(embarqueId: string): Promise<number> {
  // SAFE-CAST: RPC nueva, aún no reflejada en tipos generados (migración 2026-07-21).
  const rpc = supabase.rpc as unknown as (
    name: "refrescar_garantia_desde_tarifa",
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  const { data, error } = await rpc("refrescar_garantia_desde_tarifa", { p_embarque_id: embarqueId });
  if (error) throw mapApiError(error);
  const filasActualizadas = typeof data === "number" ? data : Number(data ?? 0);
  await registrarBitacoraEmbarque({
    accion: "Refrescó garantías desde tarifa",
    entidadId: embarqueId,
    detalles: { filasActualizadas },
  });
  return filasActualizadas;
}

