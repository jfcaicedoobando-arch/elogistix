/**
 * Service de pagos a proveedor (CxP).
 * Incluye lógica de diferencia cambiaria cuando la factura es USD y el pago en MXN.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";
import {
  crearMovimientoBancarioPago,
  eliminarMovimientoBancarioPago,
} from "./pagoProveedorMovimiento";

// Fase N: el estado se recalcula por trigger BD. `decidirEstadoFactura` sigue viviendo en `./estadoFacturaProveedor` para uso puro en UI.

export type PagoProveedor = Tables<"pagos_proveedor">;

// v13.56.1 — Columnas explícitas (auditoría: evita SELECT * en tablas financieras).
// v13.190.0 — Incluye movimiento bancario vinculado (Ola 2 · Item 3) vía embed inverso.
const PAGO_PROVEEDOR_COLUMNS =
  "id, organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd, diferencia_cambiaria_mxn, metodo_pago, referencia, cuenta_bancaria_id, notas, created_by, created_at, updated_at, deleted_at, deleted_by, bbva_movimientos!bbva_movimientos_pago_proveedor_id_fkey(id, fecha, concepto, referencia, cargo, abono, estado_conciliacion)";

export type PagoProveedorConMov = PagoProveedor & {
  bbva_movimientos: Array<{
    id: string;
    fecha: string;
    concepto: string | null;
    referencia: string | null;
    cargo: number | string;
    abono: number | string;
    estado_conciliacion: "Pendiente" | "Conciliado" | "Ignorado";
  }> | null;
};

export async function listarPagosProveedor(facturaId: string): Promise<PagoProveedorConMov[]> {
  const { data, error } = await supabase
    .from("pagos_proveedor")
    .select(PAGO_PROVEEDOR_COLUMNS)
    .eq("proveedor_factura_id", facturaId)
    .is("deleted_at", null)
    .order("fecha_pago", { ascending: false });
  if (error) throw error;
  // SAFE-CAST: embed inverso está validado por el FK bbva_movimientos_pago_proveedor_id_fkey.
  return (data ?? []) as unknown as PagoProveedorConMov[];
}

export interface RegistrarPagoProveedorInput {
  proveedor_factura_id: string;
  fecha_pago: string;
  monto: number;
  moneda: PagoProveedor["moneda"];
  /** TC MXN por 1 USD. `null` cuando el pago y la factura son MXN (no aplica). Debe ser > 0 si se envía (check `pagos_proveedor_tc_pos`). */
  tipo_cambio_usd: number | null;
  metodo_pago: string;
  referencia?: string;
  cuenta_bancaria_id?: string | null;
  notas?: string;
  /** Si la factura es USD y se paga en MXN, esta es la diferencia respecto al TC original. */
  diferencia_cambiaria_mxn?: number | null;
}

/**
 * Error tipado cuando la BD rechaza un pago porque la factura no está aprobada.
 * Se lanza tanto desde defensa temprana en el cliente como desde el mapeo del
 * error del trigger BD `trg_pago_requiere_aprobacion` (token
 * `LC_PAGO_SIN_APROBACION`).
 */
export class PagoRequiereAprobacionError extends Error {
  code = "LC_PAGO_SIN_APROBACION" as const;
  constructor(message = "La factura debe estar aprobada antes de registrar un pago.") {
    super(message);
    this.name = "PagoRequiereAprobacionError";
  }
}

function esErrorPagoSinAprobacion(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const rec = err as { message?: unknown };
  return typeof rec.message === "string" && rec.message.includes("LC_PAGO_SIN_APROBACION");
}

async function resolverOrgFactura(facturaId: string): Promise<string> {
  const { data: fact, error: errFact } = await supabase
    .from("proveedor_facturas")
    .select("organization_id, estado_aprobacion")
    .eq("id", facturaId)
    .maybeSingle();
  if (errFact) throw errFact;
  if (!fact?.organization_id) {
    throw Object.assign(new Error("Factura de proveedor no encontrada."), { code: "NOT_FOUND" });
  }
  const { data: orgActualRow, error: errOrg } = await supabase.rpc("current_user_org_id");
  if (errOrg) throw errOrg;
  const orgActual = (orgActualRow as string | null) ?? null;
  if (orgActual && orgActual !== fact.organization_id) {
    throw Object.assign(new Error("ORG_MISMATCH"), { code: "ORG_MISMATCH" });
  }
  if (fact.estado_aprobacion !== "aprobada") {
    throw new PagoRequiereAprobacionError();
  }
  return fact.organization_id;
}

function construirPayloadPago(
  input: RegistrarPagoProveedorInput,
  organizationId: string,
  userId: string | null,
): TablesInsert<"pagos_proveedor"> {
  const tc = input.tipo_cambio_usd && input.tipo_cambio_usd > 0 ? input.tipo_cambio_usd : null;
  return {
    organization_id: organizationId,
    proveedor_factura_id: input.proveedor_factura_id,
    fecha_pago: input.fecha_pago,
    monto: input.monto,
    moneda: input.moneda,
    // v13.308.8: nunca enviar `0` — el CHECK `pagos_proveedor_tc_pos` exige `IS NULL OR > 0`.
    tipo_cambio_usd: tc,
    metodo_pago: input.metodo_pago,
    referencia: input.referencia ?? "",
    cuenta_bancaria_id: input.cuenta_bancaria_id ?? null,
    notas: input.notas ?? "",
    diferencia_cambiaria_mxn: input.diferencia_cambiaria_mxn ?? null,
    created_by: userId,
  };
}

export async function registrarPagoProveedor(
  input: RegistrarPagoProveedorInput,
  userId: string | null,
): Promise<PagoProveedor> {
  // Resolvemos la organización del padre para que el INSERT no dependa del
  // default `current_user_org_id()` (que puede divergir bajo impersonación).
  // Ver Sentry JAVASCRIPT-REACT-W.
  const organizationId = await resolverOrgFactura(input.proveedor_factura_id);
  const payload = construirPayloadPago(input, organizationId, userId);

  const { data, error } = await supabase
    .from("pagos_proveedor")
    .insert(payload)
    .select()
    .single();
  if (error) {
    if (esErrorPagoSinAprobacion(error)) throw new PagoRequiereAprobacionError();
    throw error;
  }

  // R6-N1: si el pago salió de una cuenta bancaria, generamos el movimiento
  // conciliado para que /tesoreria refleje la salida de efectivo.
  if (input.cuenta_bancaria_id) {
    await crearMovimientoBancarioPago({
      pagoId: data.id,
      organizationId,
      cuentaBancariaId: input.cuenta_bancaria_id,
      facturaId: input.proveedor_factura_id,
      fechaPago: input.fecha_pago,
      monto: input.monto,
      moneda: input.moneda,
      tipoCambioUsd: input.tipo_cambio_usd,
      referencia: input.referencia,
      userId,
    });
  }


  // Recalcular estado de la factura origen
  await recalcularEstadoFactura(input.proveedor_factura_id);
  await registrarActividad({
    modulo: "cxp",
    accion: "pagar",
    entidadId: input.proveedor_factura_id,
    detalles: {
      pago_id: data.id,
      monto: input.monto,
      moneda: input.moneda,
      metodo_pago: input.metodo_pago,
      referencia: input.referencia ?? null,
    },
  });
  return data as PagoProveedor;
}


export async function eliminarPagoProveedor(id: string, facturaId: string, userId: string | null) {
  const { error } = await supabase
    .from("pagos_proveedor")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
  await recalcularEstadoFactura(facturaId);
  await registrarActividad({
    modulo: "cxp",
    accion: "eliminar_pago",
    entidadId: facturaId,
    detalles: { pago_id: id, deleted_by: userId },
  });
}

/**
 * Fase N (v13.301.85): el recálculo del estado de la factura vive en un
 * trigger BD (`trg_pagos_proveedor_recalcular_estado` +
 * `trg_notas_credito_prov_recalcular_estado`). Ver
 * `_recalc_estado_proveedor_factura`. Se conserva `decidirEstadoFactura`
 * como helper puro para UI, pero el cliente ya no escribe `estado`.
 */
async function recalcularEstadoFactura(_facturaId: string) {
  // no-op: el trigger BD hace el recálculo de forma transaccional.
  return;
}

