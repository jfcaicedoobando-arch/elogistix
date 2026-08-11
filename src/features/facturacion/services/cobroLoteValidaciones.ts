/**
 * Validaciones de renglones del cobro en lote de cliente (CxC).
 *
 * Se separa de `pagoClienteLote.ts` para respetar el límite de 200 líneas y la
 * complejidad máxima (Power of 10): `validarCobroLote` sólo orquesta.
 */
import { round2 } from "@/features/cxp/services/pagoProveedorLote";
import type { FacturaCobroCandidata, RenglonCobro } from "./pagoClienteLote";

/** Tolerancia de centavos usada en todas las comparaciones del lote. */
export const TOLERANCIA_CENTAVOS = 0.009;

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
 */
export function errorCuadre(total: number, totalRepartido: number): string | null {
  const recibido = round2(total);
  if (totalRepartido > recibido + TOLERANCIA_CENTAVOS) {
    return "La suma repartida no puede exceder el importe recibido.";
  }
  if (recibido - totalRepartido > TOLERANCIA_CENTAVOS) {
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
