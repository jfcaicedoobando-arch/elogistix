/**
 * v13.386.0 — Exclusión de comisión por embarque.
 *
 * `embarques.sin_comision`:
 *   - `null`  → hereda del cliente (`clientes.sin_comision`)
 *   - `true`  → este embarque NO genera comisión
 *   - `false` → este embarque SÍ genera comisión (aunque el cliente esté marcado)
 *
 * La resolución de la herencia vive en la BD (`resolver_sin_comision`) para que
 * el cálculo de comisiones y la UI usen exactamente la misma regla.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase/response";
import { registrarBitacoraEmbarque } from "./bitacoraEmbarques";

/** Override del embarque tal cual está guardado (sin resolver la herencia). */
export type SinComisionOverride = boolean | null;

export interface SinComisionEstado {
  /** Override propio del embarque (null = heredar del cliente). */
  override: SinComisionOverride;
  /** Resultado efectivo ya resolviendo la herencia del cliente. */
  efectivo: boolean;
}

export async function fetchSinComisionEmbarque(
  embarqueId: string,
): Promise<SinComisionEstado | null> {
  const row = await unwrap(
    supabase
      .from("embarques")
      .select("sin_comision")
      .eq("id", embarqueId)
      .is("deleted_at", null)
      .maybeSingle(),
  );
  // Ausencia no equivale a heredar ni a generar comisión. No consultar el
  // resolver hasta confirmar que el embarque sigue disponible para la UI.
  if (!row) return null;
  const efectivo = await unwrap(
    supabase.rpc("resolver_sin_comision", { p_embarque_id: embarqueId }),
  );
  return {
    override: row.sin_comision,
    efectivo: Boolean(efectivo),
  };
}

export async function setSinComisionEmbarque(
  embarqueId: string,
  valor: SinComisionOverride,
): Promise<void> {
  const row = await unwrap(
    supabase
      .from("embarques")
      .update({ sin_comision: valor })
      .eq("id", embarqueId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle(),
  );
  if (!row) throw new Error("El embarque no está disponible para actualizar la regla de comisión.");
  await registrarBitacoraEmbarque({
    accion: "actualizar_sin_comision",
    entidadId: embarqueId,
    detalles: { valor },
  });
}
