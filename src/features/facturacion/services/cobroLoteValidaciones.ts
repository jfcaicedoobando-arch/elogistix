/**
 * Validaciones de renglones del cobro en lote de cliente (CxC).
 *
 * Se separa de `pagoClienteLote.ts` para respetar el límite de 200 líneas y la
 * complejidad máxima (Power of 10): `validarCobroLote` sólo orquesta.
 */
import { round2 } from "@/features/cxp/services/pagoProveedorLote";
import type { FacturaCobroCandidata, RenglonCobro } from "./pagoClienteLote";
import { validarFechaPago } from "@/features/facturacion/domain/validarFechaPago";
import { todayLocalISO } from "@/lib/date/today";

/**
 * Tolerancia de centavos usada en las comparaciones contra SALDO (cálculo
 * flotante). Ola 11 · RNF-02: el CUADRE importe/reparto ya no usa
 * tolerancia — es exacto tras round2, igual que la RPC.
 * BUG-15 (Ola D): 0.005 = medio centavo, idéntico a la RPC
 * `registrar_pago_cliente_lote` y al trigger `tg_pago_factura_no_sobrepago`;
 * antes 0.009 aquí dejaba pasar importes que el servidor rechazaba.
 */
export const TOLERANCIA_CENTAVOS = 0.005;

/**
 * Ola 11 · RFE-02/RNF-03: misma regla de fecha que el cobro individual
 * (FE-03 / `validarFechaPago`): no futura. La regla "no anterior a la
 * emisión" se valida por factura en la RPC.
 */
export function errorFechaLote(fecha: string): string | null {
  return validarFechaPago(fecha, todayLocalISO());
}

/**
 * Ola 11 · RFE-03 (patrón FE-01): un lote en USD/EUR sin TC disponible se
 * bloquea en vez de guardarse con tipo_cambio NULL (paridad degradada).
 */
export function errorTcLote(moneda: string, tcAplicable: number | null): string | null {
  if (moneda !== "MXN" && !(tcAplicable && tcAplicable > 0)) {
    return `No hay tipo de cambio ${moneda}/MXN disponible para la fecha elegida. Intenta de nuevo en unos segundos; si el problema persiste, contacta a soporte.`;
  }
  return null;
}

/**
 * Ola 6 · RG4-6: dos renglones a la misma factura pasaban el chequeo de saldo
 * individual y en conjunto podían rebasar el saldo real. Se prohíben.
 */
export function errorFacturaDuplicada(
  facturas: FacturaCobroCandidata[],
  conMonto: RenglonCobro[],
): string | null {
  const vistos = new Set<string>();
  for (const r of conMonto) {
    if (vistos.has(r.factura_id)) {
      const numero = facturas.find((x) => x.factura_id === r.factura_id)?.numero;
      const etiqueta = numero ? `La factura ${numero}` : "Una de las facturas";
      return `${etiqueta} aparece más de una vez en el reparto: deja un solo renglón por factura.`;
    }
    vistos.add(r.factura_id);
  }
  return null;
}

/** Ningún renglón puede exceder el saldo de su propia factura. */
export function errorRenglonExcedeSaldo(
  facturas: FacturaCobroCandidata[],
  conMonto: RenglonCobro[],
): string | null {
  for (const r of conMonto) {
    const f = facturas.find((x) => x.factura_id === r.factura_id);
    if (f && r.monto > round2(f.saldo) + TOLERANCIA_CENTAVOS) {
      return `El importe asignado a la factura ${f.numero ?? ""} excede su saldo.`.replace(
        "  ",
        " ",
      );
    }
  }
  return null;
}

/**
 * Ola 5 · RG4-5: el reparto debe cuadrar EXACTO con el importe recibido; el
 * sobrante ya no es advertencia, es error.
 * Ola 11 · RNF-02: exacto de verdad — comparación tras round2, sin tolerancia
 * (antes 0.009 aquí y 0.01 en la RPC: discrepancia explotable).
 */
export function errorCuadre(total: number, totalRepartido: number): string | null {
  const recibido = round2(total);
  if (totalRepartido > recibido) {
    return "La suma repartida no puede exceder el importe recibido.";
  }
  if (recibido - totalRepartido > 0) {
    return "El reparto debe cubrir exactamente el importe recibido: ajusta el importe o los importes por factura hasta que no quede sobrante sin asignar.";
  }
  return null;
}

/** La cuenta bancaria debe estar en la misma moneda que el cobro. */
export function errorMonedaCuenta(opts: {
  cuentaId: string | null;
  monedaCuenta: string | null;
  moneda: string;
}): string | null {
  if (opts.cuentaId && opts.monedaCuenta && opts.monedaCuenta !== opts.moneda) {
    return `La cuenta está en ${opts.monedaCuenta} y el cobro en ${opts.moneda}. Elige una cuenta en la misma moneda.`;
  }
  return null;
}

/**
 * Error puntual por renglón (para resaltar la fila en la tabla), derivado de
 * las mismas reglas que `validarCobroLote`: sólo el tope por saldo aplica a un
 * renglón aislado.
 */
export function erroresPorRenglon(
  facturas: FacturaCobroCandidata[],
  renglones: RenglonCobro[],
): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const r of renglones) {
    if (r.monto <= 0) continue;
    const f = facturas.find((x) => x.factura_id === r.factura_id);
    if (f && r.monto > round2(f.saldo) + TOLERANCIA_CENTAVOS) {
      errores[r.factura_id] = "El importe excede el saldo de esta factura.";
    }
  }
  return errores;
}
