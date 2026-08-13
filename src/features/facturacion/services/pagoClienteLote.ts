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
import { round2 } from "@/features/cxp/services/pagoProveedorLote";
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
}

export interface CobroLoteResultado {
  lote_id: string;
  monto_total: number;
  pagos: Array<{ pago_id: string; factura_id: string }>;
}

/**
 * Reparte `total` entre las facturas ordenadas por vencimiento (FIFO).
 * Nunca asigna más que el saldo de cada factura; el sobrante no se aplica.
 */
export function repartirFifo(
  facturas: FacturaCobroCandidata[],
  total: number,
): { renglones: RenglonCobro[]; sobrante: number } {
  const orden = [...facturas].sort((a, b) =>
    (a.fecha_vencimiento ?? "9999-12-31").localeCompare(b.fecha_vencimiento ?? "9999-12-31"),
  );
  let restante = round2(total);
  const renglones: RenglonCobro[] = [];

  for (const f of orden) {
    if (restante <= 0) {
      renglones.push({ factura_id: f.factura_id, monto: 0 });
      continue;
    }
    const monto = round2(Math.min(restante, round2(f.saldo)));
    renglones.push({ factura_id: f.factura_id, monto });
    restante = round2(restante - monto);
  }

  return { renglones, sobrante: restante };
}

/** Asigna a cada factura su saldo completo (atajo "Liquidar todo"). */
export function repartirTodo(facturas: FacturaCobroCandidata[]): RenglonCobro[] {
  return facturas.map((f) => ({ factura_id: f.factura_id, monto: round2(f.saldo) }));
}

/** Deja el reparto en ceros (atajo "Limpiar reparto"). */
export function repartirCero(facturas: FacturaCobroCandidata[]): RenglonCobro[] {
  return facturas.map((f) => ({ factura_id: f.factura_id, monto: 0 }));
}

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
  opts: { cuentaId: string | null; monedaCuenta: string | null; moneda: string },
): ValidacionCobroLote {
  const conMonto = renglones.filter((r) => r.monto > 0);
  const totalRepartido = round2(conMonto.reduce((s, r) => s + r.monto, 0));

  if (facturas.length < 2) {
    return { error: "Selecciona al menos dos facturas para un cobro en lote.", totalRepartido };
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
    errorMonedaCuenta(opts);

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
    .select("id, metodo_pago, uuid_fiscal")
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
  // Ola 5 · RG4-12: guard de idempotencia. El botón ya se deshabilita
  // mientras la mutación está en vuelo, pero un timeout ambiguo o un
  // segundo diálogo idéntico creaban un lote duplicado completo (el
  // hash_dedupe del movimiento es por lote nuevo). Se bloquea un lote
  // idéntico (mismo cliente, fecha y total) creado en los últimos 10 min.
  const totalRenglones = round2(payload.renglones.reduce((s, r) => s + r.monto, 0));
  const { data: previos, error: errorPrevios } = await supabase
    .from("pagos_factura_lote")
    .select("id")
    .eq("cliente_id", input.cliente_id)
    .eq("fecha_pago", input.fecha_pago)
    .eq("monto_total", totalRenglones)
    .is("deleted_at", null)
    .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .limit(1);
  if (errorPrevios) throw errorPrevios;
  if ((previos ?? []).length > 0) {
    throw new Error("LC_COBRO_LOTE_DUPLICADO_RECIENTE");
  }
  const { data, error } = await supabase.rpc("registrar_pago_cliente_lote", {
    p_payload: payload as never,
  });
  if (error) throw error;
  // SAFE-CAST: la RPC devuelve jsonb con la forma de `CobroLoteResultado`.
  return data as unknown as CobroLoteResultado;
}

export { traducirErrorCobroLote } from "./pagoClienteLoteErrors";

