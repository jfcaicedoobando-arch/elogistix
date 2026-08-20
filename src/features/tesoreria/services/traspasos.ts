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
  /**
   * OLA A (A.1): clave de idempotencia generada por intento de submit. La BD
   * tiene un UNIQUE parcial sobre `traspasos_bancarios.client_request_id`, así
   * que un doble clic o un retry de red no puede duplicar el traspaso.
   */
  clientRequestId?: string | null;
}

export interface RegistrarTraspasoResult {
  id: string;
  /** `true` cuando el intento ya se había registrado (dedupe server-side). */
  duplicado: boolean;
}

/** Recupera el traspaso ya registrado con la misma clave de idempotencia. */
async function buscarTraspasoPorClave(clave: string): Promise<string | null> {
  const { data } = await supabase
    .from("traspasos_bancarios")
    .select("id")
    .eq("client_request_id", clave)
    .maybeSingle();
  return data?.id ?? null;
}

export async function registrarTraspaso(
  input: RegistrarTraspasoInput,
): Promise<RegistrarTraspasoResult> {
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
    p_client_request_id: input.clientRequestId ?? null,
  });
  if (error) {
    // 23505 sobre el UNIQUE parcial = el mismo intento ya quedó guardado.
    // No es un error para el usuario: devolvemos el traspaso existente.
    const esDuplicadoDeIntento =
      error.code === "23505" && !!input.clientRequestId;
    if (esDuplicadoDeIntento) {
      const existente = await buscarTraspasoPorClave(input.clientRequestId!);
      if (existente) return { id: existente, duplicado: true };
    }
    throw error;
  }
  return { id: data as string, duplicado: false };
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
