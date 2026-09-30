import currency from "currency.js";
import Decimal from "decimal.js";
import type { Moneda } from "@/types/db";

/**
 * Tipo estricto de moneda soportada. Ola 19 · paso 5: ya no se redeclara la
 * unión literal; es el alias central derivado del enum `moneda` de la base
 * (`src/types/db.ts`), así agregar una moneda es un solo cambio.
 */
export type { Moneda };

/**
 * Tasa de IVA estándar en México. Se usa SOLO como semilla de UI para nuevas
 * filas y como fallback derivado cuando un concepto antiguo trae únicamente el
 * flag booleano `aplica_iva`. La aritmética **nunca** debe asumirla; cada
 * cálculo recibe la tasa explícita de la fila (`resolverTasaConcepto`).
 */
export const TASA_IVA = 0.16;

/**
 * Tasas de IVA soportadas en México (selector UI).
 *
 * P2-IVA: la opción de 0% decía "0% — Exento". Eran dos tratamientos SAT
 * distintos con una sola etiqueta: "tasa 0%" es un acto gravado (da derecho a
 * acreditamiento) y "exento" no. Aquí sólo viven TASAS; `exento` y
 * `no_objeto` se eligen en el selector de tratamiento fiscal, nunca aquí.
 */
export const TASAS_IVA_MX = [
  { value: 0, label: '0% — Tasa 0%' },
  { value: 0.08, label: '8% — Frontera (estímulo)' },
  { value: 0.16, label: '16% — General' },
] as const;


const money = (n: number) => currency(n, { precision: 2 });
const ratio = (n: number) => currency(n, { precision: 4 });

/**
 * Redondeo canónico de dinero a 2 decimales. Política: "half away from zero",
 * idéntica a `ROUND(numeric, 2)` de Postgres. Decimal evita que empates como
 * 10.075 se conviertan en 10.074999… antes de redondear; ROUND_HALF_UP es
 * "half away from zero" tanto para positivos como para negativos.
 */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n === 0) return 0;
  return new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/** Multiplica con precisión decimal y redondea una sola vez al final. */
export function multiplyMoney(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return new Decimal(a).times(b).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Subtotal de una línea (cantidad × precio_unitario) redondeado a 2 decimales
 * después de multiplicar con precisión decimal. El precio unitario puede
 * tener más de dos decimales; redondearlo antes alteraría el importe.
 */
export function subtotalLinea(cantidad: number, precioUnitario: number): number {
  return multiplyMoney(cantidad, precioUnitario);
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
  return items.reduce((acc, item) => {
    const { cantidad, precioUnitario } = get(item);
    return acc.plus(subtotalLinea(cantidad, precioUnitario));
  }, new Decimal(0)).toNumber();
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

/** Tasa 8% del estímulo de la región fronteriza (literal para no ciclar). */
const TASA_FRONTERA = 0.08;

/**
 * Resuelve la tasa de IVA de un concepto con UNA sola regla canónica:
 *  1. Tratamiento explícito (`tipo_iva`): `gravado_16` → tasa general de la
 *     organización, `gravado_8` → 8%, `tasa_0`/`exento`/`no_objeto` → 0.
 *  2. Sólo si el renglón NO tiene tratamiento (legacy) se usa
 *     `tasa_iva_aplicada` y, en su ausencia, `aplica_iva ? global : 0`.
 *
 * P1 · Auditoría IVA — antes un renglón `gravado_8` con `tasa_iva_aplicada`
 * nula caía a la tasa global (16%) y se cobraba mal. El tratamiento conocido
 * NUNCA se rellena con una tasa global distinta.
 *
 * El `fallbackTasaGlobal` proviene de `useTasaIVA()` y refleja la configuración
 * por organización; nunca se mezcla con la constante `TASA_IVA` directamente
 * en las sumas.
 */
export function resolverTasaConcepto(
  concepto: { tasa_iva_aplicada?: number | null; aplica_iva?: boolean | null; tipo_iva?: string | null },
  fallbackTasaGlobal: number,
): number {
  // Literales en vez de import para no ciclar con tipoIvaSat.ts.
  switch (concepto.tipo_iva) {
    case "no_objeto":
    case "exento":
    case "tasa_0":
      return 0;
    case "gravado_8":
      return TASA_FRONTERA;
    case "gravado_16":
      return fallbackTasaGlobal;
    default:
      break;
  }
  const tasa = concepto.tasa_iva_aplicada;
  if (tasa != null && Number.isFinite(tasa)) return Number(tasa);
  return concepto.aplica_iva ? fallbackTasaGlobal : 0;
}
