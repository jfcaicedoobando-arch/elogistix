import currency from "currency.js";

/** Tipo estricto de moneda soportada */
export type Moneda = 'USD' | 'MXN' | 'EUR';

/**
 * Tasa de IVA estándar en México. Se usa SOLO como semilla de UI para nuevas
 * filas y como fallback derivado cuando un concepto antiguo trae únicamente el
 * flag booleano `aplica_iva`. La aritmética **nunca** debe asumirla; cada
 * cálculo recibe la tasa explícita de la fila (`resolverTasaConcepto`).
 */
export const TASA_IVA = 0.16;

/** Tasas de IVA soportadas en México (selector UI). */
export const TASAS_IVA_MX = [
  { value: 0, label: '0% — Exento' },
  { value: 0.08, label: '8% — Frontera' },
  { value: 0.16, label: '16% — General' },
] as const;

const money = (n: number) => currency(n, { precision: 2 });
const ratio = (n: number) => currency(n, { precision: 4 });

/**
 * Subtotal de una línea (cantidad × precio_unitario) redondeado a 2 decimales
 * con `currency.js`. Usar SIEMPRE en lugar de la multiplicación directa antes
 * de acumular a un total padre, para evitar drift de punto flotante.
 */
export function subtotalLinea(cantidad: number, precioUnitario: number): number {
  return money(precioUnitario).multiply(cantidad).value;
}

/** Calcula el subtotal (cantidad × precio unitario) */
export function calcularSubtotal(cantidad: number, precioUnitario: number): number {
  return subtotalLinea(cantidad, precioUnitario);
}

/**
 * Suma una lista de items aplicando `subtotalLinea` por fila antes de
 * acumular. Reemplaza el patrón `arr.reduce((s, c) => s + c.cant * c.pu, 0)`
 * para garantizar coincidencia exacta con los registros de pago en
 * `DialogRegistrarPago`.
 */
export function sumarSubtotales<T>(
  items: T[],
  get: (item: T) => { cantidad: number; precioUnitario: number },
): number {
  return items
    .reduce((acc, item) => {
      const { cantidad, precioUnitario } = get(item);
      return acc.add(money(precioUnitario).multiply(cantidad));
    }, currency(0, { precision: 2 }))
    .value;
}

/**
 * Acumulador genérico de montos ya calculados. Cada monto se redondea a 2
 * decimales antes de sumarse para evitar drift de punto flotante.
 */
export function sumarMontos(montos: number[]): number {
  return montos
    .reduce((acc, m) => acc.add(money(m)), currency(0, { precision: 2 }))
    .value;
}

/** Calcula el IVA sobre un monto. La tasa es obligatoria. */
export function calcularIVA(monto: number, tasa: number): number {
  return money(monto).multiply(tasa).value;
}

/** Calcula el total con IVA. La tasa es obligatoria. */
export function calcularTotalConIVA(monto: number, tasa: number): number {
  const base = money(monto);
  return base.add(base.multiply(tasa)).value;
}

/** Calcula el margen de utilidad (%) */
export function calcularMargen(venta: number, costo: number): number {
  if (venta === 0) return 0;
  return ratio(venta).subtract(costo).divide(venta).multiply(100).value;
}

/** Calcula la utilidad */
export function calcularUtilidad(venta: number, costo: number): number {
  return money(venta).subtract(costo).value;
}

/**
 * Convierte un monto a MXN según su moneda.
 *
 * @deprecated FIX C6 — usa `aMxn` / `sumarEnMxn` de `@/lib/financial/convertir`.
 * Los defaults `= 1` de esta función simulan que 1 USD vale 1 MXN cuando no se
 * pasa tipo de cambio, lo que infla o destruye los totales. El canon devuelve
 * `completo: false` en ese caso para que el consumidor lo maneje explícitamente.
 */
export function convertirAMXN(
  monto: number,
  moneda: Moneda,
  tipoCambioUSD: number = 1,
  tipoCambioEUR: number = 1
): number {
  if (moneda === 'USD') return money(monto).multiply(tipoCambioUSD).value;
  if (moneda === 'EUR') return money(monto).multiply(tipoCambioEUR).value;
  return monto;
}

/**
 * Convierte un monto a USD según su moneda.
 *
 * @deprecated FIX C6 — usa `factorEntreMonedas` de `@/lib/financial/convertir`,
 * que valida el tipo de cambio en lugar de dividir entre valores no confiables.
 */
export function convertirAUSD(
  monto: number,
  moneda: Moneda,
  tipoCambioUSD: number,
  tipoCambioEUR: number
): number {
  if (moneda === 'MXN') return money(monto).divide(tipoCambioUSD).value;
  if (moneda === 'EUR') return money(monto).multiply(tipoCambioEUR).divide(tipoCambioUSD).value;
  return monto;
}

/**
 * Resuelve la tasa de IVA de un concepto con prioridad:
 *  1. `tasa_iva_aplicada` (si está definida — incluye 0 explícito).
 *  2. `aplica_iva ? fallbackTasaGlobal : 0` para conceptos legacy.
 *
 * El `fallbackTasaGlobal` proviene de `useTasaIVA()` y refleja la configuración
 * por organización; nunca se mezcla con la constante `TASA_IVA` directamente
 * en las sumas.
 */
export function resolverTasaConcepto(
  concepto: { tasa_iva_aplicada?: number | null; aplica_iva?: boolean | null },
  fallbackTasaGlobal: number,
): number {
  const tasa = concepto.tasa_iva_aplicada;
  if (tasa != null && Number.isFinite(tasa)) return Number(tasa);
  return concepto.aplica_iva ? fallbackTasaGlobal : 0;
}
