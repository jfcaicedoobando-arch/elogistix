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
import { round2, repartirFifo } from "@/features/cxp/services/pagoProveedorLote";

export { round2, repartirFifo };

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
  renglones: RenglonCobro[];
}

export interface CobroLoteResultado {
  lote_id: string;
  monto_total: number;
  pagos: Array<{ pago_id: string; factura_id: string }>;
}

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
  for (const r of conMonto) {
    const f = facturas.find((x) => x.factura_id === r.factura_id);
    if (f && r.monto > round2(f.saldo) + 0.009) {
      return {
        error: `El importe asignado a la factura ${f.numero ?? ""} excede su saldo.`,
        totalRepartido,
      };
    }
  }
  if (totalRepartido > round2(total) + 0.009) {
    return { error: "La suma repartida no puede exceder el importe recibido.", totalRepartido };
  }
  if (opts.cuentaId && opts.monedaCuenta && opts.monedaCuenta !== opts.moneda) {
    return {
      error: `La cuenta está en ${opts.monedaCuenta} y el cobro en ${opts.moneda}. Elige una cuenta en la misma moneda.`,
      totalRepartido,
    };
  }
  return { error: null, totalRepartido };
}

/** Registra el lote de forma atómica (N pagos + 1 movimiento bancario). */
export async function registrarPagoClienteLote(
  input: RegistrarCobroLoteInput,
): Promise<CobroLoteResultado> {
  const payload = {
    ...input,
    tipo_cambio_usd:
      input.tipo_cambio_usd && input.tipo_cambio_usd > 0 ? input.tipo_cambio_usd : null,
    renglones: input.renglones
      .filter((r) => r.monto > 0)
      .map((r) => ({ ...r, monto: round2(r.monto) })),
  };
  const { data, error } = await supabase.rpc("registrar_pago_cliente_lote", {
    p_payload: payload as never,
  });
  if (error) throw error;
  // SAFE-CAST: la RPC devuelve jsonb con la forma de `CobroLoteResultado`.
  return data as unknown as CobroLoteResultado;
}

/** Mensajes amigables para los errores de la RPC. */
export function traducirErrorCobroLote(error: Error): string {
  const m = error.message ?? "";
  if (m.includes("LC_COBRO_LOTE_SIN_ROL")) {
    return "No tienes permisos para registrar cobros en lote.";
  }
  if (m.includes("LC_COBRO_LOTE_EXCEDE_SALDO")) {
    return "Un importe aplicado excede el saldo de su factura. Revisa el reparto.";
  }
  if (m.includes("LC_COBRO_LOTE_FACTURA_INVALIDA")) {
    return "Alguna factura no es del cliente seleccionado o está en otra moneda.";
  }
  if (m.includes("LC_COBRO_LOTE_CUENTA_DIVISA")) {
    return "La cuenta bancaria está en otra moneda que el cobro.";
  }
  if (m.includes("LC_COBRO_LOTE_MINIMO_FACTURAS")) {
    return "Un cobro en lote requiere al menos dos facturas.";
  }
  return "No se pudo registrar el cobro en lote.";
}
