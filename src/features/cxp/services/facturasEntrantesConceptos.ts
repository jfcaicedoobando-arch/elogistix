/**
 * v13.506.0 — Sugerencia de conceptos de costo asociada a un documento del
 * buzón CxP. El operador marca al subir qué costos del embarque cubre la
 * factura y contabilidad los recibe pre-marcados al capturar.
 */
import { supabase } from "@/integrations/supabase/client";
import { logClientError } from "@/services/observability/logClientError";
import { notifyWarning } from "@/lib/ui/appFeedback";
import type { SubirFacturaEntranteInput } from "@/features/cxp/services/facturasEntrantes.types";

/**
 * Best-effort: el documento ya quedó en el buzón; si la sugerencia falla no se
 * pierde la subida, contabilidad puede vincular a mano.
 *
 * RNF-09 (Ola 11): el fallo ya no es silencioso — se reintenta una vez, se
 * avisa en pantalla (patrón `avisarMovimientoNoCreado`) y el caller registra
 * en bitácora. Devuelve `false` si las sugerencias no quedaron guardadas.
 */
async function insertarConceptosSugeridos(
  entranteId: string,
  input: Pick<SubirFacturaEntranteInput, "conceptosSugeridos" | "organizationId">,
) {
  const lista = input.conceptosSugeridos ?? [];
  return supabase
    .from("embarque_facturas_entrantes_conceptos")
    .insert(lista.map((c) => ({
      entrante_id: entranteId,
      concepto_costo_id: c.conceptoId,
      organization_id: input.organizationId,
      monto_sugerido: c.monto,
    })));
}

export async function guardarConceptosSugeridos(
  entranteId: string,
  input: Pick<SubirFacturaEntranteInput, "conceptosSugeridos" | "organizationId">,
): Promise<boolean> {
  const lista = input.conceptosSugeridos ?? [];
  if (lista.length === 0) return true;
  let { error } = await insertarConceptosSugeridos(entranteId, input);
  if (error) {
    // Un reintento inmediato cubre fallos transitorios (red, RLS diferida).
    ({ error } = await insertarConceptosSugeridos(entranteId, input));
  }
  if (error) {
    logClientError({
      message: `No se pudieron guardar los conceptos sugeridos del buzón: ${error.message}`,
    });
    notifyWarning(undefined, {
      title: "El documento se subió, pero sin las sugerencias de conceptos",
      description:
        "Contabilidad podrá vincular los conceptos a mano al capturar la factura. " +
        "Si prefieres conservar las sugerencias, retira el documento y vuelve a subirlo.",
      duration: 10000,
    });
    return false;
  }
  return true;
}

export interface ConceptoSugeridoEntrante {
  conceptoCostoId: string;
  concepto: string;
  monto: number;
  moneda: string;
}

/** Normaliza la relación embebida de PostgREST a un shape de dominio. */
export function mapearConceptosSugeridos(
  filas: ReadonlyArray<{
    concepto_costo_id: string;
    monto_sugerido: number | null;
    conceptos_costo?: { concepto: string | null; moneda: string | null } | null;
  }> | null | undefined,
): ConceptoSugeridoEntrante[] {
  return (filas ?? []).map((f) => ({
    conceptoCostoId: f.concepto_costo_id,
    concepto: f.conceptos_costo?.concepto ?? "Concepto de costo",
    monto: Number(f.monto_sugerido ?? 0),
    moneda: f.conceptos_costo?.moneda ?? "MXN",
  }));
}
