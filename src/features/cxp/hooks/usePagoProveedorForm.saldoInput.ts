/** Proyección de la factura CxP a los campos que necesita `saldoDisponiblePago`. */
import type { FacturaCxP } from "@/features/cxp/services";
import { cruceMonedasNoSoportado } from "./usePagoProveedorForm.editar";

export function facturaSaldoInput(f: FacturaCxP) {
  return {
    moneda: f.moneda,
    saldo: f.saldo,
    total: f.total,
    subtotal: f.subtotal,
    iva: f.iva,
    ieps: f.ieps,
    retenciones: f.retenciones,
    fecha_emision: f.fecha_emision,
    estado_aprobacion: f.estado_aprobacion,
  };
}

/**
 * MNY: la diferencia cambiaria sólo se calcula y persiste en la base para el
 * par USD/MXN (`guard_pago_proveedor`). Para EUR el campo se oculta en vez de
 * aceptar un valor que el servidor descartaría (quedaba en NULL).
 */
export function soportaDiferenciaCambiariaPar(
  monedaFactura: string | null | undefined,
  monedaPago: string,
): boolean {
  return (
    (monedaPago === "MXN" && monedaFactura === "USD") ||
    (monedaPago === "USD" && monedaFactura === "MXN")
  );
}

/** Banderas derivadas de la moneda del pago vs la de la factura. */
export function banderasMonedaPago(args: {
  factura: FacturaCxP | null;
  moneda: string;
  monto: string;
  tcNum: number | null;
}) {
  const { factura, moneda, monto, tcNum } = args;
  const montoNum = Number(monto) || 0;
  const monedaFacturaExtranjera = !!factura && factura.moneda !== "MXN";
  const esUsdPagadoEnMxn = monedaFacturaExtranjera && moneda === "MXN";
  const showTc = moneda !== "MXN" || esUsdPagadoEnMxn;
  // MNY-NEW-09: cruce USD↔EUR sin conversión canónica → se bloquea explícito.
  const cruceNoSoportado = cruceMonedasNoSoportado(factura?.moneda ?? null, moneda);
  const bloqueadoPorTc = (esUsdPagadoEnMxn || (monedaFacturaExtranjera === false && moneda !== "MXN")) && !tcNum;
  const soportaDiferenciaCambiaria = soportaDiferenciaCambiariaPar(factura?.moneda, moneda);
  return {
    montoNum, monedaFacturaExtranjera, esUsdPagadoEnMxn,
    showTc: showTc && !cruceNoSoportado,
    bloqueadoPorTc: bloqueadoPorTc && !cruceNoSoportado,
    cruceNoSoportado,
    soportaDiferenciaCambiaria: soportaDiferenciaCambiaria && !cruceNoSoportado,
    /** Divisa del par contra MXN (para pedir el T/C correcto: USD o EUR). */
    monedaDelPar: monedaDelParContraMxn(factura?.moneda, moneda),
  };
}

/** Divisa del par contra MXN (para pedir el T/C correcto: USD o EUR). */
function monedaDelParContraMxn(
  monedaFactura: string | null | undefined,
  monedaPago: string,
): string | null {
  if (monedaPago !== "MXN") return monedaPago;
  return monedaFactura ?? null;
}

  };
}


