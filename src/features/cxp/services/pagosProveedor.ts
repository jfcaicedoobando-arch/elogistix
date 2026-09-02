/**
 * Service de pagos a proveedor (CxP).
 * Incluye lógica de diferencia cambiaria cuando la factura es USD y el pago en MXN.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

import { detallesPagoRegistrado } from "./pagoProveedorBitacora";
import type {
  PagoProveedor,
  PagoProveedorConMov,
  RegistrarPagoProveedorInput,
} from "./pagosProveedorTypes";

// Fase N: el estado se recalcula por trigger BD. `decidirEstadoFactura` sigue viviendo en `./estadoFacturaProveedor` para uso puro en UI.

export type { PagoProveedor, PagoProveedorConMov, RegistrarPagoProveedorInput };

// v13.56.1 — Columnas explícitas (auditoría: evita SELECT * en tablas financieras).
// v13.190.0 — Incluye movimiento bancario vinculado (Ola 2 · Item 3) vía embed inverso.
const PAGO_PROVEEDOR_COLUMNS =
  "id, organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd, diferencia_cambiaria_mxn, metodo_pago, referencia, cuenta_bancaria_id, notas, created_by, created_at, updated_at, deleted_at, deleted_by, bbva_movimientos!bbva_movimientos_pago_proveedor_id_fkey(id, fecha, concepto, referencia, cargo, abono, estado_conciliacion)";

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


/**
 * v13.823.32: el pago y su movimiento bancario se graban en UNA transacción
 * (`registrar_pago_proveedor_atomico`). Antes se insertaba el pago y después el
 * movimiento: un fallo intermedio dejaba la factura pagada sin salida bancaria,
 * y el reintento con el mismo `client_request_id` devolvía 23505 como falso
 * fracaso. La RPC es idempotente: con la misma llave devuelve el pago ya creado
 * y le asegura (repara) su movimiento.
 */
export async function registrarPagoProveedor(
  input: RegistrarPagoProveedorInput,
  _userId: string | null,
): Promise<PagoProveedor> {
  // Resolvemos la organización del padre para validar pertenencia/aprobación
  // antes de escribir. Ver Sentry JAVASCRIPT-REACT-W.
  await resolverOrgFactura(input.proveedor_factura_id);
  const tc = input.tipo_cambio_usd && input.tipo_cambio_usd > 0 ? input.tipo_cambio_usd : null;

  const { data: res, error } = await supabase.rpc("registrar_pago_proveedor_atomico", {
    p_factura_id: input.proveedor_factura_id,
    p_fecha_pago: input.fecha_pago,
    p_monto: input.monto,
    p_moneda: input.moneda,
    p_metodo_pago: input.metodo_pago,
    p_referencia: input.referencia ?? "",
    p_cuenta_bancaria_id: input.cuenta_bancaria_id ?? undefined,
    p_notas: input.notas ?? "",
    p_tipo_cambio_usd: tc ?? undefined,
    p_diferencia_cambiaria_mxn: input.diferencia_cambiaria_mxn ?? undefined,
    p_client_request_id: input.client_request_id ?? undefined,
  });
  if (error) {
    if (esErrorPagoSinAprobacion(error)) throw new PagoRequiereAprobacionError();
    throw error;
  }
  const resultado = (res ?? {}) as { pago_id?: string; movimiento_id?: string | null };
  if (!resultado.pago_id) {
    throw new Error("No se pudo registrar el pago: la base de datos no devolvió el pago creado.");
  }

  const { data: pago, error: errPago } = await supabase
    .from("pagos_proveedor")
    .select(
      "id, organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd, diferencia_cambiaria_mxn, metodo_pago, referencia, cuenta_bancaria_id, notas, created_by, created_at, updated_at, deleted_at, deleted_by",
    )
    .eq("id", resultado.pago_id)
    .single();
  if (errPago) throw errPago;

  await registrarActividad({
    modulo: "cxp",
    accion: "pagar",
    entidadId: input.proveedor_factura_id,
    detalles: detallesPagoRegistrado({
      pagoId: resultado.pago_id,
      monto: input.monto,
      moneda: input.moneda,
      metodoPago: input.metodo_pago,
      referencia: input.referencia,
      cuentaBancariaId: input.cuenta_bancaria_id ?? null,
      tipoCambioUsd: input.tipo_cambio_usd,
      movimientoCreado: Boolean(resultado.movimiento_id),
    }),
  });
  return pago as PagoProveedor;
}


export { eliminarPagoProveedor } from "./pagoProveedorEliminar";



