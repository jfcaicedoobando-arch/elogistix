/**
 * Servicio de traspasos entre cuentas propias de banco.
 *
 * La lógica atómica vive en las RPCs `registrar_traspaso_bancario` y
 * `cancelar_traspaso_bancario`; el frontend solo orquesta la llamada e
 * invalida el caché de tesorería.
 */
import { supabase } from "@/integrations/supabase/client";
import { run } from "@/lib/supabase/response";
import type { Tables } from "@/integrations/supabase/types";

export type TraspasoBancario = Tables<"traspasos_bancarios">;

export interface RegistrarTraspasoInput {
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  fecha: string;
  montoOrigen: number;
  /**
   * BL-04: obligatorio. Para traspasos de la misma moneda el llamador manda 1
   * explícitamente; nunca se asume 1 por omisión, porque eso convertía USD a
   * MXN al tipo 1:1 sin aviso.
   */
  tipoCambio: number;
  comision?: number;
  concepto?: string;
  referencia?: string;
}

export async function registrarTraspaso(
  input: RegistrarTraspasoInput,
): Promise<string> {
  if (!Number.isFinite(input.tipoCambio) || input.tipoCambio <= 0) {
    throw new Error("Captura el tipo de cambio del traspaso.");
  }
  const { data, error } = await supabase.rpc("registrar_traspaso_bancario", {
    p_cuenta_origen_id: input.cuentaOrigenId,
    p_cuenta_destino_id: input.cuentaDestinoId,
    p_fecha: input.fecha,
    p_monto_origen: input.montoOrigen,
    p_tipo_cambio: input.tipoCambio,
    p_comision: input.comision ?? 0,
    p_concepto: input.concepto ?? "",
    p_referencia: input.referencia ?? "",
  });
  if (error) throw error;
  return data as string;
}

export async function cancelarTraspaso(
  traspasoId: string,
  motivo?: string,
): Promise<void> {
  await run(
    supabase.rpc("cancelar_traspaso_bancario", {
      p_traspaso_id: traspasoId,
      p_motivo: motivo ?? "",
    }),
  );
}

export async function listarTraspasos(): Promise<TraspasoBancario[]> {
  const data = await run(
    supabase
      .from("traspasos_bancarios")
      .select("*")
      .is("deleted_at", null)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
  );
  return data ?? [];
}
