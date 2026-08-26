/**
 * Cobro en lote de cliente (pago múltiple CxC).
 *
 * Un solo depósito del cliente (una referencia bancaria) que se reparte entre
 * varias facturas del MISMO cliente y la MISMA moneda. El reparto por defecto
 * es FIFO por vencimiento: primero lo que vence antes.
 *
 * Espejo del pago en lote a proveedor (`pagoProveedorLote.ts`).
 */
import { supabase } from "@/integrations/supabase/client";
import { round2 } from "@/features/cxp/services";
import {
  errorCuadre,
  errorFacturaDuplicada,
  errorFechaLote,
  errorMonedaCuenta,
  errorRenglonExcedeSaldo,
  errorTcLote,
} from "./cobroLoteValidaciones";


export { round2 };


export interface FacturaCobroCandidata {
  factura_id: string;
  numero: string | null;
  fecha_vencimiento: string | null;
  /** Desempata el FIFO cuando dos facturas vencen el mismo día. */
  fecha_emision?: string | null;
  saldo: number;
  /** PPD ya timbrada: requiere REP por cada pago aplicado. */
  es_ppd_timbrada?: boolean;
}

export interface RenglonCobro {
  factura_id: string;
  monto: number;
}

export interface RegistrarCobroLoteInput {
  cliente_id: string;
  fecha_pago: string;
  moneda: string;
  tipo_cambio_usd?: number | null;
  forma_pago: string;
  referencia: string;
  cuenta_bancaria_id: string | null;
  notas?: string;
  /** Ola 5 · RG4-5: importe real recibido; debe ser exactamente el reparto. */
  importe_recibido: number;
  renglones: RenglonCobro[];
  /**
   * Ola 11 · RNF-01: llave de idempotencia generada al abrir el diálogo.
   * La RPC la reclama con `idempotency_claim`: un reintento del MISMO submit
   * devuelve la respuesta original en vez de duplicar el lote.
   */
  request_id: string;
}

export interface CobroLoteResultado {
  lote_id: string;
  monto_total: number;
  pagos: Array<{ pago_id: string; factura_id: string }>;
}

export { repartirFifo, repartirTodo, repartirCero } from "./cobroLoteReparto";


export { erroresPorRenglon } from "./cobroLoteValidaciones";


export interface ValidacionCobroLote {
  error: string | null;
  totalRepartido: number;
}

/** Validaciones de negocio del cobro en lote (espejo del cobro individual). */
export function validarCobroLote(
  facturas: FacturaCobroCandidata[],
  renglones: RenglonCobro[],
  total: number,
  opts: {
    cuentaId: string | null;
    monedaCuenta: string | null;
    moneda: string;
    fecha: string;
    tcAplicable: number | null;
  },
): ValidacionCobroLote {
  const conMonto = renglones.filter((r) => r.monto > 0);
  const totalRepartido = round2(conMonto.reduce((s, r) => s + r.monto, 0));

  if (facturas.length < 2) {
    return { error: "Selecciona al menos dos facturas para un cobro en lote.", totalRepartido };
  }
  // Ola 11 · RFE-02: la fecha del cobro no puede ser futura (espejo FE-03).
  const errorFecha = errorFechaLote(opts.fecha);
  if (errorFecha) {
    return { error: errorFecha, totalRepartido };
  }
  if (round2(total) <= 0) {
    return { error: "Captura el importe total que recibiste del cliente.", totalRepartido };
  }
  if (conMonto.length < 2) {
    return { error: "El importe debe alcanzar para al menos dos facturas.", totalRepartido };
  }

  const error =
    errorFacturaDuplicada(facturas, conMonto) ??
    errorRenglonExcedeSaldo(facturas, conMonto) ??
    errorCuadre(total, totalRepartido) ??
    errorMonedaCuenta(opts) ??
    errorTcLote(opts.moneda, opts.tcAplicable);

  return { error, totalRepartido };
}


/**
 * De las facturas seleccionadas, devuelve las PPD ya timbradas: cada pago que
 * se les aplique requiere su propio REP.
 */
export async function obtenerFacturasConRep(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("facturas")
    .select("id, metodo_pago, uuid_fiscal").is("deleted_at", null)
    .in("id", ids);
  if (error) throw error;
  return (data ?? [])
    .filter((f) => f.metodo_pago === "PPD" && !!f.uuid_fiscal)
    .map((f) => f.id);
}


/** Registra el lote de forma atómica (N pagos + 1 movimiento bancario). */
export async function registrarPagoClienteLote(
  input: RegistrarCobroLoteInput,
): Promise<CobroLoteResultado> {
  const payload = {
    ...input,
    // Ola 5 · RG4-5: la RPC valida que el reparto cuadre con el importe.
    importe_recibido: round2(input.importe_recibido),
    tipo_cambio_usd:
      input.tipo_cambio_usd && input.tipo_cambio_usd > 0 ? input.tipo_cambio_usd : null,
    renglones: input.renglones
      .filter((r) => r.monto > 0)
      .map((r) => ({ ...r, monto: round2(r.monto) })),
  };
  // Ola 12 · RFE-08: se retira el guard de 10 minutos de RG4-12. Rechazaba
  // lotes legítimos idénticos el mismo día sin vía de override, y el caso que
  // protegía (reintento del MISMO submit tras timeout) ya lo deduplica la RPC
  // con idempotency_claim/store vía request_id (RNF-01).
  const { data, error } = await supabase.rpc("registrar_pago_cliente_lote", {
    p_payload: payload as never,
  });
  if (error) throw error;
  // SAFE-CAST: la RPC devuelve jsonb con la forma de `CobroLoteResultado`.
  return data as unknown as CobroLoteResultado;
}

export { traducirErrorCobroLote } from "./pagoClienteLoteErrors";

