import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr } from "@/lib/supabase/response";
import type { Tables } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";
import { crearMovimientoBancarioCobro } from "@/features/facturacion/services/cobroFacturaMovimiento";
import type { Moneda } from "@/types/db";


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
      .limit(500),
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
  const { data: userData } = await supabase.auth.getUser();
  const created_by = userData.user?.id ?? null;
  const data = await unwrap(
    supabase
      .from("pagos_factura")
      .insert({
        factura_id: input.factura_id,
        fecha_pago: input.fecha_pago,
        monto: input.monto,
        moneda: input.moneda,
        tipo_cambio: input.tipo_cambio,
        monto_aplicado_factura: input.monto_aplicado_factura,
        forma_pago: input.forma_pago,
        referencia: input.referencia ?? "",
        notas: input.notas ?? "",
        diferencia_cambiaria_mxn: input.diferencia_cambiaria_mxn ?? 0,
        cuenta_bancaria_id: input.cuenta_bancaria_id ?? null,
        client_request_id: input.client_request_id ?? null,
        created_by,
      })
      .select("id")
      .single(),
  );
  const pagoId = (data as { id?: string } | null)?.id ?? null;
  // El abono bancario sólo se crea si el usuario indicó la cuenta destino.
  let movimientoBancario: RegistrarPagoResult["movimientoBancario"] = "no_aplica";
  if (pagoId && input.cuenta_bancaria_id) {
    const ok = await crearMovimientoBancarioCobro({
      pagoId,
      facturaId: input.factura_id,
      cuentaBancariaId: input.cuenta_bancaria_id,
      fechaPago: input.fecha_pago,
      monto: input.monto,
      moneda: input.moneda as Moneda,
      // C4: `tipo_cambio` aquí es el ratio pago→factura, NO el TC MXN/USD del
      // DOF. Pasarlo al movimiento bancario descuadraba el saldo; el abono se
      // registra sólo si la cuenta es de la misma moneda que el cobro.
      tipoCambioUsd: null,
      referencia: input.referencia,
      userId: created_by,
    });
    movimientoBancario = ok ? "creado" : "fallido";
  }
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



