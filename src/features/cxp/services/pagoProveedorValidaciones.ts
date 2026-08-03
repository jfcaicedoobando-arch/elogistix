/**
 * Validaciones puras del pago a proveedor (montos, IVA y totales).
 *
 * Objetivo: que nada incoherente llegue a la BD. Se separan dos niveles:
 *  - `error`: bloquea el guardado (primer error encontrado).
 *  - `avisos`: incoherencias informativas que no bloquean (p. ej. IVA raro).
 *
 * Módulo puro (sin Supabase) para poder cubrirlo con pruebas unitarias.
 */

export interface CuentaPagoInfo {
  id: string;
  moneda: string;
  banco?: string | null;
  alias?: string | null;
}

export interface FacturaPagoInfo {
  moneda: string;
  saldo: number;
  total: number;
  subtotal: number;
  iva: number;
  ieps: number;
  retenciones: number;
  fecha_emision: string;
  estado_aprobacion: "pendiente" | "aprobada" | "rechazada";
}

export interface ValidarPagoInput {
  factura: FacturaPagoInfo | null | undefined;
  /** Fecha del pago en formato ISO corto (YYYY-MM-DD). */
  fecha: string;
  /** Fecha de hoy (ISO corto) para no depender del reloj dentro del módulo. */
  hoy: string;
  /** Monto capturado tal cual (texto del input). */
  montoTexto: string;
  monto: number;
  /** Monto convertido a la moneda de la factura. */
  montoEnMonedaFactura: number;
  moneda: string;
  /** TC ya validado (> 0) o `null`. */
  tcNum: number | null;
  bloqueadoPorTc: boolean;
  requiereCuenta: boolean;
  cuenta: CuentaPagoInfo | null;
  /** Diferencia cambiaria capturada (texto vacío = no aplica). */
  diffMxnTexto: string;
  esUsdPagadoEnMxn: boolean;
  /** "crear" (default) o "editar" un pago ya registrado. */
  modo?: "crear" | "editar";
  /**
   * Sólo en modo "editar": monto del pago original expresado en la moneda de
   * la factura. Se devuelve al saldo antes de validar, porque al editar ese
   * importe deja de estar aplicado.
   */
  montoOriginalEnMonedaFactura?: number;
}


export interface ResultadoValidacionPago {
  error: string | null;
  avisos: string[];
}

const TOLERANCIA = 0.01;
/** Tolerancia de redondeo para el cuadre de totales de la factura. */
const TOLERANCIA_TOTALES = 0.05;
const TC_MIN = 0.01;
const TC_MAX = 1000;

/** ¿El texto tiene más de 2 decimales? (los centavos son el límite fiscal). */
export function tieneMasDeDosDecimales(texto: string): boolean {
  const decimales = texto.trim().split(".")[1];
  return !!decimales && decimales.replace(/0+$/, "").length > 2;
}

/**
 * Cuadre de la factura: subtotal + IVA + IEPS − retenciones ≈ total.
 * Devuelve la diferencia (0 cuando cuadra dentro de la tolerancia).
 */
export function descuadreTotalesFactura(f: FacturaPagoInfo): number {
  const calculado = f.subtotal + f.iva + f.ieps - f.retenciones;
  const dif = calculado - f.total;
  return Math.abs(dif) <= TOLERANCIA_TOTALES ? 0 : dif;
}

function validarMonto(a: ValidarPagoInput): string | null {
  if (!Number.isFinite(a.monto)) return "Captura un monto numérico válido";
  if (a.monto <= 0) return "El monto debe ser mayor a 0";
  if (tieneMasDeDosDecimales(a.montoTexto)) {
    return "El monto no puede tener más de 2 decimales";
  }
  return null;
}

function validarFechas(a: ValidarPagoInput): string | null {
  if (!a.fecha) return "Captura la fecha del pago";
  if (a.fecha > a.hoy) return "La fecha del pago no puede ser futura";
  if (a.factura?.fecha_emision && a.fecha < a.factura.fecha_emision) {
    return "La fecha del pago no puede ser anterior a la fecha de emisión de la factura";
  }
  return null;
}

function validarTipoCambio(a: ValidarPagoInput, factura: FacturaPagoInfo): string | null {
  if (a.bloqueadoPorTc) {
    return `Captura un tipo de cambio válido para pagar en MXN una factura ${factura.moneda}`;
  }
  if (a.tcNum !== null && (a.tcNum < TC_MIN || a.tcNum > TC_MAX)) {
    return `El tipo de cambio debe estar entre ${TC_MIN} y ${TC_MAX}`;
  }
  return null;
}

function validarCuenta(a: ValidarPagoInput): string | null {
  if (a.requiereCuenta && !a.cuenta) {
    return "Selecciona la cuenta bancaria de donde sale el pago";
  }
  if (a.cuenta && a.cuenta.moneda !== a.moneda) {
    return `La cuenta seleccionada es en ${a.cuenta.moneda} y el pago es en ${a.moneda}`;
  }
  return null;
}

function validarDiferenciaCambiaria(a: ValidarPagoInput): string | null {
  if (!a.esUsdPagadoEnMxn || a.diffMxnTexto.trim() === "") return null;
  const diff = Number(a.diffMxnTexto);
  if (!Number.isFinite(diff)) return "La diferencia cambiaria debe ser numérica";
  if (tieneMasDeDosDecimales(a.diffMxnTexto)) {
    return "La diferencia cambiaria no puede tener más de 2 decimales";
  }
  if (Math.abs(diff) > Math.abs(a.monto)) {
    return "La diferencia cambiaria no puede ser mayor que el monto del pago";
  }
  return null;
}

/** Errores que bloquean el guardado, en orden de prioridad. */
export function validarPagoProveedor(a: ValidarPagoInput): ResultadoValidacionPago {
  const avisos = calcularAvisosPago(a);
  const factura = a.factura;
  if (!factura) return { error: "Factura no disponible", avisos };
  if (factura.estado_aprobacion !== "aprobada") {
    return { error: "La factura debe estar aprobada antes de registrar pagos", avisos };
  }
  if (factura.saldo <= TOLERANCIA) {
    return { error: "La factura no tiene saldo pendiente", avisos };
  }
  const error =
    validarMonto(a) ??
    validarFechas(a) ??
    validarTipoCambio(a, factura) ??
    validarCuenta(a) ??
    validarDiferenciaCambiaria(a) ??
    (a.montoEnMonedaFactura > factura.saldo + TOLERANCIA
      ? `El monto excede el saldo pendiente (${factura.moneda})`
      : null);
  return { error, avisos };
}

/** Incoherencias informativas de IVA/totales que conviene mostrar al usuario. */
export function calcularAvisosPago(a: ValidarPagoInput): string[] {
  const f = a.factura;
  if (!f) return [];
  const avisos: string[] = [];
  const descuadre = descuadreTotalesFactura(f);
  if (descuadre !== 0) {
    avisos.push(
      `Los totales de la factura no cuadran: subtotal + IVA + IEPS − retenciones difiere del total en ${descuadre.toFixed(2)} ${f.moneda}. Revisa la captura antes de pagar.`,
    );
  }
  if (f.subtotal > 0 && f.iva > 0) {
    const tasa = (f.iva / f.subtotal) * 100;
    const esperadas = [0, 8, 16];
    if (!esperadas.some((t) => Math.abs(tasa - t) < 0.5)) {
      avisos.push(
        `El IVA de la factura equivale a ${tasa.toFixed(2)}% del subtotal (no es 0%, 8% ni 16%).`,
      );
    }
  }
  if (f.retenciones > f.subtotal) {
    avisos.push("Las retenciones son mayores que el subtotal de la factura.");
  }
  return avisos;
}
