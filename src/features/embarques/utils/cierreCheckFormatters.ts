/**
 * Formatters de detalle para checks de cierre.
 * Extraídos de `cierreCheckMeta.ts` para mantener éste bajo 200 líneas (v13.89.4).
 */
import { formatCurrencySafe } from "@/lib/formatters";

const fmtMoney = (n: unknown, moneda = "MXN"): string => formatCurrencySafe(n, moneda);

export const pick = (d: unknown, key: string): unknown =>
  d && typeof d === "object" ? (d as Record<string, unknown>)[key] : undefined;

export const fmtCxc = (d: unknown): string | null => {
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
