import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr } from "@/lib/supabase/response";
import type { Tables } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";

import { CAP_LISTA } from "@/constants/queryCaps";


export type PagoFactura = Tables<"pagos_factura">;

export interface RegistrarPagoInput {
  factura_id: string;
  fecha_pago: string;
  monto: number;
  moneda: PagoFactura["moneda"];
  tipo_cambio: number;
  monto_aplicado_factura: number;
  forma_pago: string;
  referencia?: string;
  notas?: string;
  /**
   * Diferencia cambiaria en MXN. Aplica cuando la factura es USD/EUR y el
   * pago se recibe en MXN: monto MXN recibido − (monto_aplicado_factura × TC
   * de emisión). El UI calcula y manda el valor; default 0.
   */
  diferencia_cambiaria_mxn?: number;
  /**
   * Cuenta donde entró el dinero. Cuando se envía, se registra el abono
   * bancario conciliado (el saldo del banco sube). Opcional: sin cuenta el
   * cobro sólo entra al banco al importar/conciliar el estado de cuenta.
   */
  cuenta_bancaria_id?: string | null;
  /**
   * BL-14: UUID generado por el dialog por intento de submit. La columna
   * tiene índice UNIQUE parcial: un retry de red con el mismo UUID choca
   * (23505) en vez de duplicar el cobro.
   */
  client_request_id?: string | null;
}

export async function listarPagosFactura(facturaId: string): Promise<PagoFactura[]> {
  return unwrapOr(
    supabase
      .from("pagos_factura")
      .select("*")
      .eq("factura_id", facturaId)
      // A6: los pagos eliminados (borrado lógico) no deben listarse ni sumar.
      .is("deleted_at", null)
      .order("fecha_pago", { ascending: false })
      .limit(CAP_LISTA),
    [],
  );
}

/**
 * Inserta un pago y devuelve el `id` recién creado (útil para encadenar el
 * timbrado del REP en facturas PPD). Devuelve `null` si Supabase no regresa
 * la fila (no debería suceder en producción, pero los tests con mocks viejos
 * pueden devolver `data: null`).
 *
 * RG15 (Ola 3): además del id, reporta qué pasó con el abono bancario; antes
 * el fallo cross-moneda se tragaba en silencio (`logger.warn` y nada más).
 */
export interface RegistrarPagoResult {
  pagoId: string | null;
  /** "creado" = abono en bbva_movimientos; "fallido" = se pidió cuenta pero no
   *  se generó (moneda distinta sin TC, o error de inserción);
   *  "no_aplica" = el usuario no indicó cuenta destino. */
  movimientoBancario: "creado" | "fallido" | "no_aplica";
}

export async function registrarPagoFactura(
  input: RegistrarPagoInput,
): Promise<RegistrarPagoResult> {
  // D2 (v13.823.382): una sola RPC atómica e idempotente. Antes se insertaba el
  // pago y DESPUÉS se pedía el abono bancario: si el abono fallaba, el cobro
  // quedaba guardado sin reflejo en el banco, y un retry de red chocaba (23505)
  // aunque el cobro ya existiera.
  const res = await unwrap(
    supabase.rpc("registrar_pago_factura_atomico", {
      p_factura_id: input.factura_id,
      p_fecha_pago: input.fecha_pago,
      p_monto: input.monto,
      p_moneda: input.moneda,
      p_tipo_cambio: input.tipo_cambio,
      p_monto_aplicado_factura: input.monto_aplicado_factura,
      p_forma_pago: input.forma_pago,
      p_referencia: input.referencia ?? "",
      p_notas: input.notas ?? "",
      p_diferencia_cambiaria_mxn: input.diferencia_cambiaria_mxn ?? 0,
      p_cuenta_bancaria_id: input.cuenta_bancaria_id ?? null,
      p_client_request_id: input.client_request_id ?? null,
    }),
  );
  // SAFE-CAST: contrato jsonb de la RPC (pago_id / movimiento_bancario).
  const out = (res ?? {}) as { pago_id?: string; movimiento_bancario?: string };
  const pagoId = out.pago_id ?? null;
  const movimientoBancario: RegistrarPagoResult["movimientoBancario"] =
    out.movimiento_bancario === "creado" ? "creado" : "no_aplica";
  // P2-6 (R5): los pagos de cliente no aparecían en la bitácora/actividad
  // (sólo los de proveedor), así que la línea de tiempo quedaba incompleta.
  await registrarActividad({
    modulo: "facturacion",
    accion: "registrar_pago",
    entidadId: input.factura_id,
    detalles: {
      pago_id: pagoId,
      monto: input.monto,
      moneda: input.moneda,
      monto_aplicado_factura: input.monto_aplicado_factura,
      forma_pago: input.forma_pago,
      referencia: input.referencia ?? null,
    },
  });
  return { pagoId, movimientoBancario };
}

export { PagoConRepVivoError, eliminarPagoFactura } from "./eliminarPago";



