/**
 * Helper compartido para aplicar una tarifa marítima al formulario de cotización.
 * Extraído de `TarifaVinculadaPanel` para que el modal `BuscarTarifaDialog` y
 * el bloque inline `SugerenciasTarifaInline` usen exactamente la misma lógica
 * de seteo + reset de overrides + trigger de validación.
 *
 * v13.31.0 — Pack C
 */
import type { UseFormSetValue, UseFormTrigger } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";
import { supabase } from "@/integrations/supabase/client";
import { toDbJson } from "@/lib/supabase/cast";

const OPTS = { shouldValidate: true, shouldDirty: true } as const;

export function aplicarTarifaAlForm(
  setValue: UseFormSetValue<CotizacionFormValues>,
  trigger: UseFormTrigger<CotizacionFormValues>,
  row: TopTarifaRow,
): void {
  setValue("tarifaId", row.id, OPTS);
  setValue("tarifaOverride", {}, OPTS);
  setValue("tiempoTransitoDias", row.transit_time_dias ?? undefined, OPTS);
  setValue("diasLibresDestino", row.dias_libres_demoras ?? 0, OPTS);
  setValue("cartaGarantia", !!row.naviera_carta_garantia_activa, OPTS);
  if (row.tipo_contenedor_id) {
    setValue("tipoContenedor", row.tipo_contenedor_id, OPTS);
  }
  void trigger([
    "tiempoTransitoDias",
    "diasLibresDestino",
    "cartaGarantia",
    "tipoContenedor",
  ]);
}

/**
 * Registra en bitácora cuando el usuario aplica una tarifa desde las
 * sugerencias inline del wizard (vs abrir el modal). Best-effort: si falla,
 * no rompe el flujo de aplicación de tarifa.
 */
export async function logTarifaSugeridaAplicada(args: {
  tarifaId: string;
  ranking: 1 | 2 | 3;
  cotizacionId?: string | null;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("bitacora_actividad").insert({
      usuario_id: user.id,
      usuario_email: user.email ?? "",
      accion: "tarifa_sugerida_aplicada",
      modulo: "Cotizaciones",
      entidad_id: args.cotizacionId ?? args.tarifaId,
      entidad_nombre: `Top ${args.ranking}`,
      detalles: toDbJson({
        tarifa_id: args.tarifaId,
        ranking: args.ranking,
        cotizacion_id: args.cotizacionId ?? null,
        borrador: !args.cotizacionId,
      }),
    });
  } catch {
    // Best-effort: no interrumpe el flujo del usuario.
  }
}
