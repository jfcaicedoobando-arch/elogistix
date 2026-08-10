/**
 * Ola 10 · M9 — Totales del estado de cuenta CxC.
 *
 * Dos bugs corregidos respecto a la versión anterior:
 *  1. Las facturas `Parcialmente pagada` quedaban fuera del monto vencido,
 *     aunque su saldo restante ya estuviera vencido.
 *  2. Se tomaba la moneda de `facturas[0]` y se filtraba todo el estado de
 *     cuenta a esa divisa: las facturas en la otra moneda desaparecían del
 *     total, del saldo y del vencido. Ahora se agrupa POR MONEDA y nunca se
 *     suman divisas distintas.
 *
 * Lógica pura y exportada para poder probarla sin desplegar la función.
 */

export interface FacturaTotalizable {
  total: number | null;
  saldo: number | null;
  moneda: string | null;
  fecha_vencimiento: string | null;
  estado: string | null;
}

export interface TotalesMoneda {
  moneda: string;
  total: number;
  saldo: number;
  vencido: number;
}

const MONEDA_DEFAULT = "MXN";

/** Estados cuyo saldo ya no se cobra (no entran al vencido). */
const ESTADOS_LIQUIDADOS = new Set(["Pagada", "Cancelada", "Sustituida"]);

function diasVencidos(isoVencimiento: string | null, ahora: Date): number | null {
  if (!isoVencimiento) return null;
  const venc = new Date(isoVencimiento);
  if (Number.isNaN(venc.getTime())) return null;
  return Math.floor((ahora.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Agrupa los totales por moneda. El orden es MXN primero y luego alfabético,
 * para que el correo siempre presente las divisas en el mismo orden.
 */
export function calcularTotalesPorMoneda(
  facturas: FacturaTotalizable[],
  ahora: Date = new Date(),
): TotalesMoneda[] {
  const porMoneda = new Map<string, TotalesMoneda>();

  for (const f of facturas) {
    const moneda = f.moneda ?? MONEDA_DEFAULT;
    const acc = porMoneda.get(moneda) ?? { moneda, total: 0, saldo: 0, vencido: 0 };
    acc.total += f.total ?? 0;
    acc.saldo += f.saldo ?? 0;

    // M9: las parciales SÍ cuentan — su saldo pendiente puede estar vencido.
    const saldo = f.saldo ?? 0;
    const liquidada = ESTADOS_LIQUIDADOS.has(f.estado ?? "");
    if (!liquidada && saldo > 0) {
      const dias = diasVencidos(f.fecha_vencimiento, ahora) ?? 0;
      if (dias > 0) acc.vencido += saldo;
    }

    porMoneda.set(moneda, acc);
  }

  return [...porMoneda.values()].sort((a, b) => {
    if (a.moneda === MONEDA_DEFAULT) return -1;
    if (b.moneda === MONEDA_DEFAULT) return 1;
    return a.moneda.localeCompare(b.moneda);
  });
}

export function formatCurrency(value: number, moneda: string): string {
  return `${value.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${moneda}`;
}

/** Texto de una línea por divisa, p. ej. "1,000.00 MXN · 500.00 USD". */
export function formatPorMoneda(
  totales: TotalesMoneda[],
  campo: "total" | "saldo" | "vencido",
): string {
  if (totales.length === 0) return formatCurrency(0, MONEDA_DEFAULT);
  return totales.map((t) => formatCurrency(t[campo], t.moneda)).join(" · ");
}

export const MONEDA_ESTADO_CUENTA_DEFAULT = MONEDA_DEFAULT;
