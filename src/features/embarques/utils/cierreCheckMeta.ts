/**
 * v13.89.2 — Metadatos por regla del checklist de cierre.
 *
 * Tabla pura `regla → { label, responsable, ruta(embarqueId), formatDetalle(detalle) }`.
 * Función pura → testeable sin React.
 */

export type ResponsableCierre =
  | "Contador"
  | "Tesorero"
  | "Cobranza"
  | "Auxiliar contable"
  | "Coordinador logístico"
  | "Operador"
  | "Ventas"
  | "Sistema";

export interface CierreCheckMeta {
  label: string;
  responsable: ResponsableCierre;
  /** Ruta destino (relativa a la app) o null si no aplica acción. */
  ruta: ((embarqueId: string) => string) | null;
  ctaLabel: string;
  formatDetalle: (detalle: unknown) => string | null;
}

const fmtMoney = (n: unknown, moneda = "MXN"): string => {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 2,
  }).format(num);
};

const pick = (d: unknown, key: string): unknown =>
  d && typeof d === "object" ? (d as Record<string, unknown>)[key] : undefined;

const fmtCxc = (d: unknown): string | null => {
  const monto = pick(d, "monto_pendiente") ?? pick(d, "saldo") ?? pick(d, "pendiente");
  const facturas = pick(d, "facturas_pendientes") ?? pick(d, "facturas");
  const partes: string[] = [];
  if (Number(facturas) > 0) partes.push(`${facturas} factura(s) por cobrar`);
  if (Number(monto) > 0) partes.push(`saldo ${fmtMoney(monto)}`);
  return partes.length > 0 ? partes.join(" · ") : null;
};

const fmtCxp = (d: unknown): string | null => {
  const monto = pick(d, "monto_pendiente") ?? pick(d, "saldo") ?? pick(d, "pendiente");
  const facturas = pick(d, "facturas_pendientes") ?? pick(d, "facturas");
  const partes: string[] = [];
  if (Number(facturas) > 0) partes.push(`${facturas} factura(s) de proveedor por pagar`);
  if (Number(monto) > 0) partes.push(`monto ${fmtMoney(monto)}`);
  return partes.length > 0 ? partes.join(" · ") : null;
};

const fmtDocs = (d: unknown): string | null => {
  const faltantes = pick(d, "faltantes") ?? pick(d, "docs_faltantes") ?? pick(d, "pendientes");
  if (Array.isArray(faltantes) && faltantes.length > 0) {
    return `${faltantes.length} documento(s) faltante(s): ${faltantes.slice(0, 3).join(", ")}${
      faltantes.length > 3 ? "…" : ""
    }`;
  }
  if (Number(faltantes) > 0) return `${faltantes} documento(s) faltante(s)`;
  return null;
};

const fmtMargen = (d: unknown): string | null => {
  const margen = pick(d, "margen") ?? pick(d, "margen_actual");
  const minimo = pick(d, "minimo") ?? pick(d, "margen_minimo");
  if (margen != null && minimo != null) {
    return `Margen actual ${Number(margen).toFixed(1)}% (mínimo ${Number(minimo).toFixed(1)}%)`;
  }
  return null;
};

const fmtConceptos = (d: unknown): string | null => {
  const pendientes = pick(d, "pendientes") ?? pick(d, "conceptos");
  if (Number(pendientes) > 0) return `${pendientes} concepto(s) pendiente(s)`;
  if (Array.isArray(pendientes) && pendientes.length > 0)
    return `${pendientes.length} concepto(s) pendiente(s)`;
  return null;
};

const fmtContenedores = (d: unknown): string | null => {
  const sin = pick(d, "sin_datos") ?? pick(d, "incompletos");
  if (Number(sin) > 0) return `${sin} contenedor(es) sin peso/volumen`;
  return null;
};

const tabEmbarque = (tab: string) => (id: string) => `/embarques/${id}?tab=${tab}`;

/**
 * Tabla principal. Acepta variantes de nombre (la RPC ha cambiado entre versiones).
 */
const META: Record<string, CierreCheckMeta> = {
  cxc_sin_pendientes: {
    label: "Cuentas por cobrar al día",
    responsable: "Cobranza",
    ruta: tabEmbarque("facturacion"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtCxc,
  },
  cxc_cobrada: {
    label: "Cuentas por cobrar al día",
    responsable: "Cobranza",
    ruta: tabEmbarque("facturacion"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtCxc,
  },
  cxp_sin_pendientes: {
    label: "Cuentas por pagar al día",
    responsable: "Tesorero",
    ruta: tabEmbarque("facturacion"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtCxp,
  },
  cxp_pagada: {
    label: "Cuentas por pagar al día",
    responsable: "Tesorero",
    ruta: tabEmbarque("facturacion"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtCxp,
  },
  documentos_completos: {
    label: "Documentos requeridos completos",
    responsable: "Coordinador logístico",
    ruta: tabEmbarque("documentos"),
    ctaLabel: "Ir a Documentos",
    formatDetalle: fmtDocs,
  },
  docs_completos: {
    label: "Documentos requeridos completos",
    responsable: "Coordinador logístico",
    ruta: tabEmbarque("documentos"),
    ctaLabel: "Ir a Documentos",
    formatDetalle: fmtDocs,
  },
  pnl_margen_minimo: {
    label: "Utilidad mínima alcanzada",
    responsable: "Ventas",
    ruta: tabEmbarque("pnl"),
    ctaLabel: "Ver P&L",
    formatDetalle: fmtMargen,
  },
  comision_calculada: {
    label: "Comisión devengada calculada",
    responsable: "Sistema",
    ruta: tabEmbarque("pnl"),
    ctaLabel: "Ver P&L",
    formatDetalle: () => null,
  },
  contenedores_datos_completos: {
    label: "Datos de contenedores capturados (peso y volumen)",
    responsable: "Operador",
    ruta: tabEmbarque("resumen"),
    ctaLabel: "Ir a Resumen",
    formatDetalle: fmtContenedores,
  },
  venta_conceptos_facturados: {
    label: "Todos los conceptos de venta facturados",
    responsable: "Contador",
    ruta: tabEmbarque("facturacion"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtConceptos,
  },
  costo_conceptos_con_factura: {
    label: "Todos los costos tienen factura de proveedor recibida",
    responsable: "Auxiliar contable",
    ruta: tabEmbarque("costos"),
    ctaLabel: "Ir a Costos",
    formatDetalle: fmtConceptos,
  },
  costos_liquidados: {
    label: "Todos los costos están liquidados (pagados al proveedor)",
    responsable: "Tesorero",
    ruta: tabEmbarque("facturacion"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtConceptos,
  },
};

const FALLBACK: CierreCheckMeta = {
  label: "Validación pendiente",
  responsable: "Sistema",
  ruta: null,
  ctaLabel: "",
  formatDetalle: (d) => (d == null ? null : JSON.stringify(d)),
};

export function getCierreCheckMeta(regla: string): CierreCheckMeta {
  return META[regla] ?? { ...FALLBACK, label: regla };
}
