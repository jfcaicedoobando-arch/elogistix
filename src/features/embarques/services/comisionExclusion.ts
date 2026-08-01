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
import { run, unwrap } from "@/lib/supabase/response";

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
): Promise<SinComisionEstado> {
  const [row, efectivo] = await Promise.all([
    unwrap(
      supabase
        .from("embarques")
        .select("sin_comision")
        .eq("id", embarqueId)
        .maybeSingle(),
    ),
    unwrap(supabase.rpc("resolver_sin_comision", { p_embarque_id: embarqueId })),
  ]);
  return {
    override: (row?.sin_comision ?? null) as SinComisionOverride,
    efectivo: Boolean(efectivo),
  };
}

export async function setSinComisionEmbarque(
  embarqueId: string,
  valor: SinComisionOverride,
): Promise<void> {
  await run(
    supabase.from("embarques").update({ sin_comision: valor }).eq("id", embarqueId),
  );
}
