/**
 * Edición de una factura de proveedor existente.
 * Permite corregir folio/fechas/importes/categoría/notas sin borrar y recapturar.
 *
 * Reglas:
 * - El proveedor y el CFDI fiscal NO son editables (rompen trazabilidad).
 * - El nuevo total no puede ser menor a lo ya pagado en `pagos_proveedor`.
 * - Si cambian campos sensibles y la factura estaba `aprobada`, se regresa a
 *   `pendiente` y se limpia `aprobada_por`/`aprobada_at`.
 * - Revalida duplicado (proveedor + folio + emisión) excluyendo el propio id.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import {
  existeFacturaDuplicada,
  type ProveedorFacturaRow,
} from "./proveedorFacturas";

export interface ActualizarFacturaPayload {
  folio_proveedor: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  dias_credito: number;
  moneda: ProveedorFacturaRow["moneda"];
  tipo_cambio_usd: number;
  subtotal: number;
  iva: number;
  ieps: number;
  retenciones: number;
  categoria_presupuesto_id: string;
  notas: string;
}

/** Subconjunto de columnas necesario para precargar el form de edición. */
export type FacturaParaEdicion = Pick<
  ProveedorFacturaRow,
  | "id" | "proveedor_id" | "proveedor_nombre" | "folio_proveedor"
  | "fecha_emision" | "fecha_vencimiento" | "dias_credito"
  | "moneda" | "tipo_cambio_usd"
  | "subtotal" | "iva" | "ieps" | "retenciones" | "total"
  | "categoria_presupuesto_id" | "notas" | "estado_aprobacion"
>;

const FACTURA_EDIT_SELECT = `
  id, proveedor_id, proveedor_nombre, folio_proveedor,
  fecha_emision, fecha_vencimiento, dias_credito,
  moneda, tipo_cambio_usd,
  subtotal, iva, ieps, retenciones, total,
  categoria_presupuesto_id, notas, estado_aprobacion
` as const;

/** Carga una factura de proveedor con los campos que el form de edición necesita. */
export async function fetchFacturaParaEdicion(id: string): Promise<FacturaParaEdicion | null> {
  const { data, error } = await supabase
    .from("proveedor_facturas")
    .select(FACTURA_EDIT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  // SAFE-CAST: select acotado al subset declarado en FacturaParaEdicion.
  return (data as FacturaParaEdicion | null) ?? null;
}


export class SaldoNegativoError extends Error {
  code = "SALDO_NEGATIVO" as const;
  totalPagado: number;
  constructor(totalPagado: number) {
    super("El nuevo total no puede ser menor a lo ya pagado");
    this.totalPagado = totalPagado;
  }
}

/** Campos cuyo cambio fuerza re-aprobación si la factura estaba aprobada. */
const CAMPOS_SENSIBLES: Array<keyof ActualizarFacturaPayload> = [
  "folio_proveedor", "fecha_emision",
  "moneda", "tipo_cambio_usd",
  "subtotal", "iva", "ieps", "retenciones",
];

function detectarCambioSensible(
  actual: Pick<ProveedorFacturaRow, "folio_proveedor" | "fecha_emision" | "moneda" | "tipo_cambio_usd" | "subtotal" | "iva" | "ieps" | "retenciones">,
  payload: ActualizarFacturaPayload,
): boolean {
  return CAMPOS_SENSIBLES.some((k) => {
    // SAFE-CAST: lectura indexada por key tipada de objetos planos.
    const a = (actual as unknown as Record<string, unknown>)[k];
    // SAFE-CAST: lectura indexada por key tipada de objetos planos.
    const b = (payload as unknown as Record<string, unknown>)[k];
    if (typeof a === "number" || typeof b === "number") return Number(a) !== Number(b);
    return a !== b;
  });
}

export async function actualizarFacturaProveedor(
  id: string,
  payload: ActualizarFacturaPayload,
): Promise<ProveedorFacturaRow> {
  // 1) Lee factura actual: necesitamos proveedor_id y estado_aprobacion.
  const { data: actual, error: errActual } = await supabase
    .from("proveedor_facturas")
    .select("id, proveedor_id, estado_aprobacion, folio_proveedor, fecha_emision, moneda, tipo_cambio_usd, subtotal, iva, ieps, retenciones")
    .eq("id", id)
    .single();
  if (errActual) throw errActual;

  // 2) Duplicado (proveedor + folio + emisión) excluyendo self.
  const dup = await existeFacturaDuplicada(
    actual.proveedor_id, payload.folio_proveedor, payload.fecha_emision, id,
  );
  if (dup) {
    const err = new Error("Ya existe otra factura con este folio para este proveedor en esta fecha.") as Error & { code?: string };
    err.code = "DUPLICADO";
    throw err;
  }

  // 3) Validar que el nuevo total no quede por debajo de lo ya pagado.
  //    Total = Subtotal + IVA + IEPS − Retenciones.
  const nuevoTotal =
    (Number(payload.subtotal) || 0) +
    (Number(payload.iva) || 0) +
    (Number(payload.ieps) || 0) -
    (Number(payload.retenciones) || 0);
  // Ola 9 · A6: ignorar pagos borrados (soft-delete) y descontar las notas de
  // crédito ya aplicadas/timbradas; si no, el "total pagado" se infla y bloquea
  // ediciones legítimas de la factura.
  const { data: pagos, error: errPagos } = await supabase
    .from("pagos_proveedor")
    .select("monto")
    .eq("proveedor_factura_id", id)
    .is("deleted_at", null);
  if (errPagos) throw errPagos;
  const { data: notas, error: errNotas } = await supabase
    .from("proveedor_notas_credito")
    .select("monto")
    .eq("proveedor_factura_id", id)
    .in("estado", ["Aplicada"])
    .is("deleted_at", null);
  if (errNotas) throw errNotas;
  const totalNotas = (notas ?? []).reduce((acc, n) => acc + (Number(n.monto) || 0), 0);
  const totalPagado =
    (pagos ?? []).reduce((acc, p) => acc + (Number(p.monto) || 0), 0) + totalNotas;

  // Tolerancia de 1 centavo por redondeos.
  if (nuevoTotal + 0.01 < totalPagado) throw new SaldoNegativoError(totalPagado);

  // 4) ¿Hubo cambio sensible? → re-aprobación si estaba aprobada.
  const forzarReaprobacion =
    detectarCambioSensible(actual, payload) && actual.estado_aprobacion === "aprobada";

  // 5) UPDATE.
  const updateBody: Partial<ProveedorFacturaRow> = {
    folio_proveedor: payload.folio_proveedor.trim(),
    fecha_emision: payload.fecha_emision,
    fecha_vencimiento: payload.fecha_vencimiento,
    dias_credito: payload.dias_credito,
    moneda: payload.moneda,
    tipo_cambio_usd: payload.tipo_cambio_usd,
    subtotal: payload.subtotal,
    iva: payload.iva,
    ieps: payload.ieps,
    retenciones: payload.retenciones,
    total: nuevoTotal,
    categoria_presupuesto_id: payload.categoria_presupuesto_id,
    notas: payload.notas,
    updated_at: new Date().toISOString(),
  };
  if (forzarReaprobacion) {
    updateBody.estado_aprobacion = "pendiente";
    updateBody.aprobada_por = null;
    updateBody.aprobada_at = null;
  }

  const { data, error } = await supabase
    .from("proveedor_facturas")
    .update(updateBody)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "editar",
    entidadId: id,
    entidadNombre: data.folio_interno ?? data.folio_proveedor ?? "",
    detalles: {
      total: data.total,
      moneda: data.moneda,
      forzo_reaprobacion: forzarReaprobacion,
    },
  });
  return data;
}
