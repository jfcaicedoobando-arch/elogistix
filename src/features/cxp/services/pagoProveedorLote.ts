/**
 * Pago en lote a proveedor (v13.445.0).
 *
 * Una sola salida de dinero (una referencia bancaria) que se reparte entre
 * varias facturas del MISMO proveedor y la MISMA moneda.
 *
 * El reparto por defecto es FIFO por vencimiento: se liquida primero la factura
 * más próxima a vencer y el remanente se aplica a las siguientes.
 */
import { supabase } from "@/integrations/supabase/client";
import { roundMoney } from "@/lib/financial/financialUtils";
import { errorFechaLote } from "@/features/facturacion/services/cobroLoteValidaciones";


export interface FacturaLoteCandidata {
  factura_id: string;
  folio_proveedor: string | null;
  fecha_vencimiento: string | null;
  saldo: number;
}

export interface RenglonLote {
  factura_id: string;
  monto: number;
}

export interface RegistrarPagoLoteInput {
  proveedor_id: string;
  fecha_pago: string;
  moneda: string;
  tipo_cambio_usd?: number | null;
  metodo_pago: string;
  referencia: string;
  cuenta_bancaria_id: string | null;
  notas?: string;
  /** Ola 11 · RNF-05 (espejo RG4-5): importe real de la transferencia; debe cuadrar exacto con el reparto. */
  importe_recibido: number;
  /** BL-02 (espejo RNF-01 de CxC): llave de idempotencia por intento de submit. */
  request_id?: string | null;
  renglones: RenglonLote[];
}

/**
 * Redondeo contable a 2 decimales (evita centavos fantasma en el reparto).
 * Ola 9 · B3: delega en `roundMoney` (fuente única de redondeo financiero).
 */
export function round2(n: number): number {
  return roundMoney(Number.isFinite(n) ? n : 0);
}


/**
 * Reparte `total` entre las facturas ordenadas por vencimiento (FIFO).
 * Nunca asigna más que el saldo de cada factura; el sobrante no se aplica.
 */
export function repartirFifo(
  facturas: FacturaLoteCandidata[],
  total: number,
): { renglones: RenglonLote[]; sobrante: number } {
  const orden = [...facturas].sort((a, b) =>
    (a.fecha_vencimiento ?? "9999-12-31").localeCompare(b.fecha_vencimiento ?? "9999-12-31"),
  );
  let restante = round2(total);
  const renglones: RenglonLote[] = [];

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

export interface ValidacionLote {
  error: string | null;
  totalRepartido: number;
}

/**
 * RTC-01: reglas por renglón extraídas de `validarLote` (límite de complejidad).
 * RNF-06 (espejo RG4-6 de CxC): una misma factura no puede aparecer dos veces,
 * y ningún renglón puede exceder el saldo de su factura.
 */
function errorRenglonesLote(
  facturas: FacturaLoteCandidata[],
  conMonto: RenglonLote[],
): string | null {
  const vistos = new Set<string>();
  for (const r of conMonto) {
    if (vistos.has(r.factura_id)) {
      const folio = facturas.find((x) => x.factura_id === r.factura_id)?.folio_proveedor;
      const etiqueta = folio ? `La factura ${folio}` : "Una de las facturas";
      return `${etiqueta} aparece más de una vez en el reparto: deja un solo renglón por factura.`;
    }
    vistos.add(r.factura_id);
    const f = facturas.find((x) => x.factura_id === r.factura_id);
    if (f && r.monto > round2(f.saldo) + 0.005) {
      return `El importe asignado a la factura ${f.folio_proveedor ?? ""} excede su saldo.`;
    }
  }
  return null;
}

/** Validaciones de negocio del lote, espejo de las del pago individual. */
export function validarLote(
  facturas: FacturaLoteCandidata[],
  renglones: RenglonLote[],
  total: number,
  opts: {
    requiereCuenta: boolean;
    cuentaId: string | null;
    monedaCuenta: string | null;
    moneda: string;
    fecha: string;
  },
): ValidacionLote {
  const conMonto = renglones.filter((r) => r.monto > 0);
  const totalRepartido = round2(conMonto.reduce((s, r) => s + r.monto, 0));

  if (facturas.length < 2) {
    return { error: "Selecciona al menos dos facturas para un pago en lote.", totalRepartido };
  }
  // Ola 11 · RFE-02/RNF-03: la fecha del pago no puede ser futura.
  const errorFecha = errorFechaLote(opts.fecha);
  if (errorFecha) {
    return { error: errorFecha, totalRepartido };
  }
  if (round2(total) <= 0) {
    return { error: "Captura el importe total de la transferencia.", totalRepartido };
  }
  if (conMonto.length < 2) {
    return { error: "El importe debe alcanzar para al menos dos facturas.", totalRepartido };
  }
  const errorRenglones = errorRenglonesLote(facturas, conMonto);
  if (errorRenglones) {
    return { error: errorRenglones, totalRepartido };
  }
  // Ola 11 · RNF-02: cuadre exacto tras round2 (canon de dinero, sin tolerancia).
  if (totalRepartido > round2(total)) {
    return { error: "La suma repartida no puede exceder el importe de la transferencia.", totalRepartido };
  }
  // Ola 11 · RNF-05 (espejo RG4-5 de CxC): el sobrante ya no es advertencia,
  // es error — lo que no se reparte no se registra en ninguna parte.
  if (round2(total) - totalRepartido > 0) {
    return {
      error:
        "El reparto debe cubrir exactamente el importe de la transferencia: ajusta el importe o los importes por factura hasta que no quede sobrante sin asignar.",
      totalRepartido,
    };
  }
  if (opts.requiereCuenta && !opts.cuentaId) {
    return { error: "Selecciona la cuenta bancaria de donde sale el pago.", totalRepartido };
  }
  if (opts.cuentaId && opts.monedaCuenta && opts.monedaCuenta !== opts.moneda) {
    return {
      error: `La cuenta está en ${opts.monedaCuenta} y el pago en ${opts.moneda}. Elige una cuenta en la misma moneda.`,
      totalRepartido,
    };
  }
  return { error: null, totalRepartido };
}

/** Registra el lote de forma atómica (N pagos + 1 movimiento bancario). */
export async function registrarPagoProveedorLote(input: RegistrarPagoLoteInput): Promise<string> {
  const payload = {
    ...input,
    // Ola 11 · RNF-05: la RPC valida que el reparto cuadre con la transferencia.
    importe_recibido: round2(input.importe_recibido),
    tipo_cambio_usd: input.tipo_cambio_usd && input.tipo_cambio_usd > 0 ? input.tipo_cambio_usd : null,
    renglones: input.renglones.filter((r) => r.monto > 0).map((r) => ({ ...r, monto: round2(r.monto) })),
  };
  // Ola 12 · RFE-08: se retira el guard de 10 minutos (espejo RG4-12). Ver
  // pagoClienteLote.ts: la deduplicación real es la idempotencia server-side
  // de la RPC (RNF-01); el guard rechazaba lotes legítimos.
  const { data, error } = await supabase.rpc("registrar_pago_proveedor_lote", {
    p_payload: payload as never,
  });
  if (error) throw error;
  return data as string;
}
