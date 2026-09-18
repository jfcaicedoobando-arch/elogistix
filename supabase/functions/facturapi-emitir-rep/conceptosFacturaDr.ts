/**
 * P1 · Auditoría IVA — Lectura de los renglones de la factura relacionada.
 *
 * Distingue explícitamente dos situaciones que ANTES se confundían:
 *  - consulta OK con CERO filas → factura legacy sin renglones (se permite el
 *    respaldo por encabezado);
 *  - ERROR de lectura → no se sabe nada: se corta el REP antes del claim y
 *    antes de llamar al PAC (si se continuara, el complemento se timbraría sin
 *    las retenciones ISR/IVA que sí trae la factura).
 */

/** Renglón mínimo que necesita el cálculo de traslados y retenciones. */
export interface ConceptoDrRow {
  tipo_iva?: string | null;
  tasa_iva_aplicada?: number | null;
  tasa_ret_isr?: number | null;
  tasa_ret_iva?: number | null;
  total?: number | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
}

const COLUMNAS =
  "tipo_iva, tasa_iva_aplicada, tasa_ret_isr, tasa_ret_iva, total, cantidad, precio_unitario";

export type LecturaConceptosDr =
  | { ok: true; conceptos: ConceptoDrRow[] }
  | { ok: false; detalle: string };

interface QueryLike {
  select(cols: string): QueryLike;
  eq(col: string, val: unknown): QueryLike;
  is(col: string, val: unknown): Promise<{ data: ConceptoDrRow[] | null; error: { message: string } | null }>;
}

interface ClienteLike {
  from(tabla: string): QueryLike;
}

export async function leerConceptosDr(
  supabase: ClienteLike,
  facturaId: string,
): Promise<LecturaConceptosDr> {
  const { data, error } = await supabase
    .from("conceptos_factura")
    .select(COLUMNAS)
    .eq("factura_id", facturaId)
    .is("deleted_at", null);
  if (error) return { ok: false, detalle: error.message };
  return { ok: true, conceptos: data ?? [] };
}
