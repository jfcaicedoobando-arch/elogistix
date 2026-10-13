/**
 * Edición de una factura de proveedor existente.
 * Permite corregir folio/fechas/importes/categoría/notas sin borrar y recapturar.
 *
 * Reglas de negocio y validaciones viven en `proveedorFacturas.update.reglas.ts`.
 */
import { supabase } from "@/integrations/supabase/client";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { primeraFila } from "@/lib/supabase/primeraFila";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";
import { registrarActividad } from "@/services/bitacora/registrar";

import {
  existeFacturaDuplicada,
  type ProveedorFacturaRow,
} from "./proveedorFacturas";
import {
  SaldoNegativoError,
  calcularTotal,
  detectarCambioSensible,
  validarTotalNoMenorAPagado,
  validarCambioMonedaSinAplicaciones,
} from "./proveedorFacturas.update.reglas";
import type {
  ActualizarFacturaPayload,
  FacturaParaEdicion,
} from "./proveedorFacturas.update.types";

export { SaldoNegativoError };
export type { ActualizarFacturaPayload, FacturaParaEdicion };

const FACTURA_EDIT_SELECT = `
  id, proveedor_id, proveedor_nombre, folio_proveedor,
  fecha_emision, fecha_vencimiento, dias_credito,
  moneda, tipo_cambio_usd,
  subtotal, iva, ieps, retenciones, total,
  categoria_presupuesto_id, notas, estado_aprobacion, updated_at
` as const;

/** Carga una factura de proveedor con los campos que el form de edición necesita. */
export async function fetchFacturaParaEdicion(id: string): Promise<FacturaParaEdicion | null> {
  const scope = captureAuthOperationScope();
  let query = supabase
    .from("proveedor_facturas")
    .select(FACTURA_EDIT_SELECT)
    .eq("id", id).is("deleted_at", null);
  if (scope.organizationId) query = query.eq("organization_id", scope.organizationId);
  const { data, error } = await query.maybeSingle();
  scope.assertCurrent();
  if (error) throw error;
  // SAFE-CAST: select acotado al subset declarado en FacturaParaEdicion.
  return (data as FacturaParaEdicion | null) ?? null;
}

async function leerFacturaActualViva(id: string, scope: ReturnType<typeof captureAuthOperationScope>) {
  let read = supabase.from("proveedor_facturas")
    .select("id, proveedor_id, estado_aprobacion, folio_proveedor, fecha_emision, moneda, tipo_cambio_usd, subtotal, iva, ieps, retenciones")
    .eq("id", id).is("deleted_at", null);
  if (scope.organizationId) read = read.eq("organization_id", scope.organizationId);
  const { data: actual, error } = await read.single();
  scope.assertCurrent();
  if (error) throw error;
  if (!actual) throw Object.assign(new Error("La factura de proveedor ya no existe o fue eliminada."), { code: "NOT_FOUND" });
  return actual;
}

export async function actualizarFacturaProveedor(
  id: string,
  payload: ActualizarFacturaPayload,
  /**
   * H5 (Ola 4): bloqueo optimista. `updated_at` leído al abrir el formulario;
   * si otro usuario ya guardó, el UPDATE no toca filas y se avisa en vez de
   * sobrescribir su trabajo.
   */
  expectedUpdatedAt?: string | null,
): Promise<ProveedorFacturaRow> {
  const scope = captureAuthOperationScope();
  // 1) Lee factura actual: necesitamos proveedor_id y estado_aprobacion.
  const actual = await leerFacturaActualViva(id, scope);


  // 2) Duplicado (proveedor + folio + emisión) excluyendo self.
  const dup = await existeFacturaDuplicada(
    actual.proveedor_id, payload.folio_proveedor, payload.fecha_emision, id,
  );
  scope.assertCurrent();
  if (dup) {
    const err = new Error("Ya existe otra factura con este folio para este proveedor en esta fecha.") as Error & { code?: string };
    err.code = "DUPLICADO";
    throw err;
  }

  // 3) Validar que el nuevo total no quede por debajo de lo ya pagado.
  const nuevoTotal = calcularTotal(payload);
  if (actual.moneda !== payload.moneda) await validarCambioMonedaSinAplicaciones(id);
  await validarTotalNoMenorAPagado(id, nuevoTotal);
  scope.assertCurrent();

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

  let query = supabase
    .from("proveedor_facturas")
    .update(updateBody)
    .eq("id", id).is("deleted_at", null);
  if (scope.organizationId) query = query.eq("organization_id", scope.organizationId);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { data: filas, error } = await query.select();
  if (error) throw error;
  const data = primeraFila(filas);
  if (!data) {
    if (expectedUpdatedAt) throw conflictoConcurrenciaError();
    throw new Error("No se guardaron los cambios: la factura ya no existe o no tienes permiso.");
  }

  if (!scope.isCurrent()) return data;
  await registrarActividad({
    authScope: scope,
    ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
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
