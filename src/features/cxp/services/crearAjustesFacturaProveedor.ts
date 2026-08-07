/**
 * Crear renglones de ajuste de costo en el embarque cuando la factura
 * del proveedor difiere del costo devengado.
 *
 * Modelo (v13.303.97):
 *  - Por cada `vinculo` con `monto ≠ montoOriginal`, se agrega un nuevo
 *    `concepto_costo` en el mismo embarque con `monto = monto − montoOriginal`
 *    (firmado). Signo negativo → descuento del proveedor → utilidad sube.
 *  - El ajuste se registra también en `proveedor_facturas_conceptos` para
 *    trazabilidad y para que el trigger `tg_pfc_recalc_liq` propague estado.
 *  - `origen='ajuste_factura_proveedor'` permite distinguirlos en UI y en
 *    la reversión al cancelar la factura (trigger BD `tg_reverse_ajustes_on_cancel`).
 *
 * Idempotencia: antes de crear, se soft-deletean ajustes previos de la
 * misma factura (mismo `proveedor_factura_id`). Así una edición futura no
 * duplica renglones.
 */
import currency from "currency.js";
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { Database } from "@/integrations/supabase/types";
import type { VinculoLinea } from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers";

type Moneda = Database["public"]["Enums"]["moneda"];
const TOLERANCIA = 0.01;
const ORIGEN_AJUSTE = "ajuste_factura_proveedor";

export interface CrearAjustesInput {
  facturaId: string;
  organizationId: string;
  folio: string;
  fechaEmision: string;
  moneda: Moneda;
  proveedorId: string;
  proveedorNombre: string;
  vinculos: Record<string, VinculoLinea>;
}

export interface CrearAjustesResult {
  ajustesCreados: number;
}

/** Soft-delete de ajustes previos de esta factura (idempotencia). */
async function limpiarAjustesPrevios(facturaId: string): Promise<void> {
  const { data: puentes } = await supabase
    .from("proveedor_facturas_conceptos")
    .select("concepto_costo_id")
    .eq("proveedor_factura_id", facturaId);
  const ids = (puentes ?? [])
    .map((p) => p.concepto_costo_id)
    .filter((id): id is string => !!id);
  if (ids.length === 0) return;
  await supabase
    .from("conceptos_costo")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids)
    .eq("origen", ORIGEN_AJUSTE)
    .is("deleted_at", null);
}

export async function crearAjustesFacturaProveedor(
  input: CrearAjustesInput,
): Promise<CrearAjustesResult> {
  const deltas = Object.values(input.vinculos)
    .map((v) => ({
      vinculo: v,
      delta: currency(v.monto, { precision: 4 }).subtract(v.montoOriginal).value,
    }))
    .filter((x) => Math.abs(x.delta) > TOLERANCIA);

  if (deltas.length === 0) return { ajustesCreados: 0 };

  await limpiarAjustesPrevios(input.facturaId);

  const nuevos = deltas.map((d) => ({
    embarque_id: d.vinculo.embarqueId,
    organization_id: input.organizationId,
    proveedor_id: input.proveedorId,
    proveedor_nombre: input.proveedorNombre,
    concepto: `Ajuste factura ${input.folio}: ${d.vinculo.descripcion}`,
    monto: d.delta,
    moneda: input.moneda,
    origen: ORIGEN_AJUSTE,
    estado_liquidacion: "Pagado" as const,
    fecha_pago: input.fechaEmision,
    referencia_pago: input.folio,
  }));

  const { data: creados, error: errIns } = await supabase
    .from("conceptos_costo")
    .insert(nuevos)
    .select("id");
  if (errIns) throw errIns;

  const rows = (creados ?? []).map((c, i) => ({
    proveedor_factura_id: input.facturaId,
    organization_id: input.organizationId,
    concepto_costo_id: c.id,
    descripcion: nuevos[i].concepto,
    cantidad: 1,
    monto: nuevos[i].monto,
  }));
  const { error: errLink } = await supabase
    .from("proveedor_facturas_conceptos")
    .insert(rows);
  if (errLink) throw errLink;

  await registrarActividad({
    modulo: "cxp",
    accion: "crear_ajustes_factura_proveedor",
    entidadId: input.facturaId,
    entidadNombre: input.folio,
    detalles: { ajustesCreados: rows.length },
  });

  return { ajustesCreados: rows.length };
}
