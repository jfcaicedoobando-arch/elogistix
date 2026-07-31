/**
 * Formatters de detalle para checks de cierre.
 * Extraídos de `cierreCheckMeta.ts` para mantener éste bajo 200 líneas (v13.89.4).
 */
import { formatCurrencySafe } from "@/lib/formatters";

const fmtMoney = (n: unknown, moneda = "MXN"): string => formatCurrencySafe(n, moneda);

export const pick = (d: unknown, key: string): unknown =>
  d && typeof d === "object" ? (d as Record<string, unknown>)[key] : undefined;

interface SaldoPorMoneda {
  moneda?: string;
  total?: number;
  pagado?: number;
  saldo?: number;
  notas_credito?: number;
  facturas_pendientes?: number;
}

function readPorMoneda(d: unknown): SaldoPorMoneda[] | null {
  const arr = pick(d, "por_moneda");
  return Array.isArray(arr) ? (arr as SaldoPorMoneda[]) : null;
}

function fmtSaldoPorMoneda(rows: SaldoPorMoneda[]): string | null {
  const partes = rows
    .filter((r) => Number(r.saldo ?? 0) > 0.01)
    .map((r) => fmtMoney(r.saldo, (r.moneda ?? "MXN").toUpperCase()));
  return partes.length > 0 ? partes.join(" + ") : null;
}

export const fmtCxc = (d: unknown): string | null => {
  const rows = readPorMoneda(d);
  if (rows) {
    const pendientes = rows.reduce((n, r) => n + Number(r.facturas_pendientes ?? 0), 0);
    const saldoTxt = fmtSaldoPorMoneda(rows);
    const partes: string[] = [];
    if (pendientes > 0) partes.push(`${pendientes} factura(s) por cobrar`);
    if (saldoTxt) partes.push(`saldo ${saldoTxt}`);
    return partes.length > 0 ? partes.join(" · ") : null;
  }
  // Legacy shape (retrocompat con caché): asume MXN.
  const total = Number(pick(d, "total") ?? 0);
  const pagado = Number(pick(d, "pagado") ?? 0);
  const saldo = total - pagado;
  const facturas = pick(d, "facturas_pendientes");
  const partes: string[] = [];
  if (Number(facturas) > 0) partes.push(`${facturas} factura(s) por cobrar`);
  if (saldo > 0.01) partes.push(`saldo ${fmtMoney(saldo)}`);
  return partes.length > 0 ? partes.join(" · ") : null;
};

export const fmtCxp = (d: unknown): string | null => {
  const rows = readPorMoneda(d);
  if (rows) {
    const pendientes = rows.reduce((n, r) => n + Number(r.facturas_pendientes ?? 0), 0);
    const saldoTxt = fmtSaldoPorMoneda(rows);
    const partes: string[] = [];
    if (pendientes > 0) partes.push(`${pendientes} factura(s) de proveedor por pagar`);
    if (saldoTxt) partes.push(`monto ${saldoTxt}`);
    return partes.length > 0 ? partes.join(" · ") : null;
  }
  const total = Number(pick(d, "total") ?? 0);
  const pagado = Number(pick(d, "pagado") ?? 0);
  const saldo = total - pagado;
  const facturas = pick(d, "facturas_pendientes");
  const partes: string[] = [];
  if (Number(facturas) > 0) partes.push(`${facturas} factura(s) de proveedor por pagar`);
  if (saldo > 0.01) partes.push(`monto ${fmtMoney(saldo)}`);
  return partes.length > 0 ? partes.join(" · ") : null;
};

export const fmtDocs = (d: unknown): string | null => {
  const faltantes = pick(d, "faltantes") ?? pick(d, "docs_faltantes") ?? pick(d, "pendientes");
  if (Array.isArray(faltantes) && faltantes.length > 0) {
    return `${faltantes.length} documento(s) faltante(s): ${faltantes.slice(0, 3).join(", ")}${
      faltantes.length > 3 ? "…" : ""
    }`;
  }
  if (Number(faltantes) > 0) return `${faltantes} documento(s) faltante(s)`;
  return null;
};

export const fmtMargen = (d: unknown): string | null => {
  const utilidad = pick(d, "utilidad");
  const minimo = pick(d, "minimo");
  if (utilidad != null && minimo != null) {
    return `Utilidad actual ${fmtMoney(utilidad)} (mínimo ${fmtMoney(minimo)})`;
  }
  return null;
};

export const fmtVentaPendientes = (d: unknown): string | null => {
  const p = Number(pick(d, "pendientes") ?? 0);
  const ep = Number(pick(d, "en_proforma") ?? 0);
  const partes: string[] = [];
  if (p > 0) partes.push(`${p} concepto(s) pendiente(s)`);
  if (ep > 0) partes.push(`${ep} en proforma sin facturar`);
  return partes.length > 0 ? partes.join(" · ") : null;
};

export const fmtSinFactura = (d: unknown): string | null => {
  const n = Number(pick(d, "sin_factura") ?? pick(d, "pendientes") ?? 0);
  if (n > 0) return `${n} concepto(s) sin factura de proveedor`;
  return null;
};

// v13.347.0 — Buzón CxP del embarque (facturas de proveedor recibidas).
export const fmtEntrantesPendientes = (d: unknown): string | null => {
  const n = Number(pick(d, "pendientes") ?? 0);
  if (n <= 0) return null;
  const dias = Number(pick(d, "dias_max") ?? 0);
  const base = `${n} factura(s) del buzón sin capturar`;
  return dias > 0 ? `${base} · el más antiguo lleva ${dias} día(s)` : base;
};

export const fmtEntrantesEvidencia = (d: unknown): string | null => {
  const n = Number(pick(d, "proveedores_sin_evidencia") ?? 0);
  if (n <= 0) return null;
  const nombres = pick(d, "proveedores");
  if (Array.isArray(nombres) && nombres.length > 0) {
    const muestra = nombres.slice(0, 3).map(String).join(", ");
    return `${n} proveedor(es) sin factura adjunta: ${muestra}${nombres.length > 3 ? "…" : ""}`;
  }
  return `${n} proveedor(es) sin factura adjunta`;
};


export const fmtContenedores = (d: unknown): string | null => {
  const sin = Number(pick(d, "contenedores_incompletos") ?? pick(d, "sin_datos") ?? 0);
  if (sin > 0) return `${sin} contenedor(es) sin peso/volumen`;
  return null;
};

export const fmtContenedoresFechas = (d: unknown): string | null => {
  const sin = Number(pick(d, "contenedores_sin_fechas") ?? 0);
  if (sin > 0) return `${sin} contenedor(es) sin fecha de descarga o devolución`;
  return null;
};

export const fmtRepPendientes = (d: unknown): string | null => {
  const n = Number(pick(d, "pendientes") ?? 0);
  if (n > 0) return `${n} pago(s) PPD sin REP timbrado`;
  return null;
};

// B-042: reglas actuales de la RPC validar_cierre_embarque (20260723051800).
export const fmtComisionesNoDefinitivas = (d: unknown): string | null => {
  const n = Number(pick(d, "no_definitivas") ?? 0);
  if (n > 0) return `${n} comisión(es) devengada(s) pendiente(s) de pasar a definitiva`;
  return null;
};

export const fmtMargenMinimoPct = (d: unknown): string | null => {
  const pct = pick(d, "margen_pct");
  const min = pick(d, "minimo_pct");
  const utilidad = pick(d, "utilidad_mxn");
  if (pct == null && min == null) return null;
  const partes: string[] = [];
  partes.push(`Margen actual ${pct == null ? "—" : `${Number(pct).toFixed(2)}%`} (mínimo ${Number(min ?? 0).toFixed(2)}%)`);
  if (utilidad != null) partes.push(`utilidad ${fmtMoney(utilidad)}`);
  return partes.join(" · ");
};
