/**
 * Queries de conceptos venta/costo asociados a un embarque.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ConceptoVentaRow = Tables<"conceptos_venta">;
type ConceptoCostoRow = Tables<"conceptos_costo">;

/**
 * SAT 01 — `conceptos_venta.tipo_iva` (tratamiento fiscal explícito). La
 * columna llega con la migración `20260918000100_iva_no_objeto_sat01.sql`; los
 * tipos generados se regeneran al aplicarla, así que aquí se declara aparte
 * para que la lectura compile y no haya que volver a tocar este archivo.
 * `null` = fila legacy: se resuelve por `aplica_iva` + `tasa_iva_aplicada`.
 */
export type ConceptoVentaConTipoIva = ConceptoVentaRow & { tipo_iva: string | null };

const COLS_CONCEPTOS_VENTA =
  // R179-01: `tasa_iva_aplicada` se omitía y el cálculo del modal caía al
  // flag global; el RPC sí usaba la tasa real de la fila y el total
  // confirmado cambiaba al guardar.
  // SAT 01: `tipo_iva` se selecciona para que una fila "No objeto" se hidrate
  // como tal al editar, en vez de degradarse a legacy/exento.
  "id, embarque_id, descripcion, cantidad, precio_unitario, total, moneda, organization_id, created_at, estado_facturacion, proforma_id, aplica_iva, tasa_iva_aplicada, tipo_iva, contenedor_id";

export async function fetchEmbarqueConceptosVenta(
  embarqueId: string,
): Promise<ConceptoVentaConTipoIva[]> {
  const { data, error } = await supabase
    .from("conceptos_venta")
    .select(COLS_CONCEPTOS_VENTA)
    .eq("embarque_id", embarqueId)
    // `actualizar_embarque_completo` borra en lógico (deleted_at) los conceptos
    // pendientes que el usuario quitó. Sin este filtro el detalle volvía a
    // mostrarlos y parecía que el guardado no se aplicaba.
    .is("deleted_at", null);
  if (error) throw error;
  // SAFE-CAST: la columna `tipo_iva` existe en BD tras la migración; los tipos
  // generados pueden ir un paso atrás. `?? null` no aplica aquí: PostgREST ya
  // devuelve null cuando la fila es legacy.
  return (data ?? []) as unknown as ConceptoVentaConTipoIva[];
}

export async function fetchEmbarqueConceptosCosto(embarqueId: string): Promise<ConceptoCostoRow[]> {
  const { data, error } = await supabase
    .from("conceptos_costo")
    .select(
      "id, embarque_id, concepto, monto, moneda, proveedor_id, proveedor_nombre, estado_liquidacion, fecha_pago, fecha_vencimiento, referencia_pago, organization_id, created_at",
    )
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []) as ConceptoCostoRow[];
}

