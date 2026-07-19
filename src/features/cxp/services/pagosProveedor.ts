/**
 * Service de pagos a proveedor (CxP).
 * Incluye lógica de diferencia cambiaria cuando la factura es USD y el pago en MXN.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { registrarActividad } from "@/lib/domain/bitacora/registrar";
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
  tipo_cambio_usd: number;
  metodo_pago: string;
  referencia?: string;
  cuenta_bancaria_id?: string | null;
  notas?: string;
  /** Si la factura es USD y se paga en MXN, esta es la diferencia respecto al TC original. */
  diferencia_cambiaria_mxn?: number | null;
}

export async function registrarPagoProveedor(
  input: RegistrarPagoProveedorInput,
  userId: string | null,
): Promise<PagoProveedor> {
  // Resolvemos la organización del padre para que el INSERT no dependa del
  // default `current_user_org_id()` (que puede divergir bajo impersonación o
  // cambio reciente de organización activa). Si la org del usuario actual no
  // coincide con la de la factura, abortamos con un error tipado para que el
  // toast en español lo capture (evita el PostgrestError RLS opaco visto en
  // Sentry JAVASCRIPT-REACT-W).
  const { data: fact, error: errFact } = await supabase
    .from("proveedor_facturas")
    .select("organization_id")
    .eq("id", input.proveedor_factura_id)
    .maybeSingle();
  if (errFact) throw errFact;
  if (!fact?.organization_id) {
    throw Object.assign(new Error("Factura de proveedor no encontrada."), {
      code: "NOT_FOUND",
    });
  }

  const { data: orgActualRow, error: errOrg } = await supabase.rpc("current_user_org_id");
  if (errOrg) throw errOrg;
  const orgActual = (orgActualRow as string | null) ?? null;
  if (orgActual && orgActual !== fact.organization_id) {
    throw Object.assign(new Error("ORG_MISMATCH"), { code: "ORG_MISMATCH" });
  }

  const payload: TablesInsert<"pagos_proveedor"> = {
    organization_id: fact.organization_id,
    proveedor_factura_id: input.proveedor_factura_id,
    fecha_pago: input.fecha_pago,
    monto: input.monto,
    moneda: input.moneda,
    tipo_cambio_usd: input.tipo_cambio_usd,
    metodo_pago: input.metodo_pago,
    referencia: input.referencia ?? "",
    cuenta_bancaria_id: input.cuenta_bancaria_id ?? null,
    notas: input.notas ?? "",
    diferencia_cambiaria_mxn: input.diferencia_cambiaria_mxn ?? null,
    created_by: userId,
  };
  const { data, error } = await supabase
    .from("pagos_proveedor")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

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

