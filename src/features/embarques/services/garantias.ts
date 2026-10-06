import type { Database } from "@/integrations/supabase/types";
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
  type Args = Database["public"]["Functions"]["set_garantia_estado"]["Args"];
  const args = {
    p_id: input.id,
    p_estado: input.estado ?? null,
    p_fecha_deposito: input.fecha_deposito ?? null,
    p_fecha_liberacion: input.fecha_liberacion ?? null,
    p_monto: input.monto_deposito_usd ?? null,
    p_referencia: input.referencia_deposito ?? null,
    p_notas: input.notas ?? null,
  } satisfies { [K in keyof Args]: Args[K] | null };
  // SAFE-CAST: SQL accepts explicit NULL for optional parameters; generated Args omit nullability.
  // Keep the existing NULL payload and invoke rpc on its client (the SDK reads this.rest).
  const { error } = await supabase.rpc("set_garantia_estado", args as Args);
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
  const { data, error } = await supabase.rpc("refrescar_garantia_desde_tarifa", { p_embarque_id: embarqueId });
  if (error) throw mapApiError(error);
  const filasActualizadas = typeof data === "number" ? data : Number(data ?? 0);
  await registrarBitacoraEmbarque({
    accion: "Refrescó garantías desde tarifa",
    entidadId: embarqueId,
    detalles: { filasActualizadas },
  });
  return filasActualizadas;
}

