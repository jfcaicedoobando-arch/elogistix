/**
 * Conversión Proforma(s) → Factura (borrador).
 * Llama al RPC `convertir_proformas_a_factura` (Fase 1/2 del flujo lineal
 * Proforma → Factura → Timbrado → Pago → REP).
 *
 * Soporta fusión N:1 (varias proformas del mismo cliente en una sola factura).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ConvertirProformaParams {
  proformaIds: string[];
  serieId: string;
  metodoPago: "PUE" | "PPD";
  formaPago: string;   // catálogo SAT
  usoCfdi: string;     // catálogo SAT
  diasCredito?: number;
  notas?: string | null;
  requestId?: string;  // idempotencia
}

export interface ConvertirProformaResult {
  facturaId: string;
  facturaNumero: string;
}

export async function convertirProformaAFactura(
  params: ConvertirProformaParams,
): Promise<ConvertirProformaResult> {
  if (!params.proformaIds.length) {
    throw new Error("Selecciona al menos una proforma");
  }
  const { data, error } = await supabase.rpc("convertir_proformas_a_factura", {
    p_proforma_ids: params.proformaIds,
    p_serie_id: params.serieId,
    p_metodo_pago: params.metodoPago,
    p_forma_pago: params.formaPago,
    p_uso_cfdi: params.usoCfdi,
    p_dias_credito: params.diasCredito ?? 0,
    p_notas: params.notas ?? undefined,
    p_request_id: params.requestId ?? undefined,
  });
  if (error) throw error;
  // SAFE-CAST: el RPC devuelve la fila completa de `facturas`; sólo extraemos
  // id y numero para el caller.
  const row = data as { id: string; numero: string } | null;
  if (!row?.id) throw new Error("No se pudo generar la factura");
  return { facturaId: row.id, facturaNumero: row.numero };
}

/**
 * Devuelve la primera serie de facturación activa de la organización
 * (ordenada por `prefijo`). Se usa para el flujo de conversión "de un clic":
 * el usuario no elige serie; se toma la default y puede cambiarla en el
 * borrador antes de timbrar.
 */
export async function fetchPrimeraSerieActiva(
  organizationId: string,
): Promise<{ id: string; prefijo: string } | null> {
  const { data, error } = await supabase
    .from("factura_series")
    .select("id, prefijo")
    .eq("organization_id", organizationId)
    .eq("activa", true)
    .order("prefijo")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
