/**
 * Bitácora de aplicaciones de tarifa sugerida (sugerencias inline del wizard).
 * Encapsula la lectura de `auth.getUser` + insert en `bitacora_actividad`
 * que antes vivía en `components/seccionRuta/aplicarTarifa.ts`.
 */
import { supabase } from "@/integrations/supabase/client";
import { insertBitacora } from "@/features/auditoria/services/bitacora";

export interface LogTarifaSugeridaArgs {
  tarifaId: string;
  ranking: 1 | 2 | 3;
  cotizacionId?: string | null;
}

/** Best-effort: si falla, no rompe el flujo de aplicación de tarifa. */
export async function logTarifaSugeridaAplicada(args: LogTarifaSugeridaArgs): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await insertBitacora({
      usuarioId: user.id,
      usuarioEmail: user.email ?? "",
      accion: "tarifa_sugerida_aplicada",
      modulo: "cotizaciones",
      entidadId: args.cotizacionId ?? args.tarifaId,
      entidadNombre: `Top ${args.ranking}`,
      detalles: {
        tarifa_id: args.tarifaId,
        ranking: args.ranking,
        cotizacion_id: args.cotizacionId ?? null,
        borrador: !args.cotizacionId,
      },
    });
  } catch {
    // Best-effort.
  }
}
