/**
 * v13.89.2 — Metadatos por regla del checklist de cierre.
 * v13.89.3 — `ruta(embarqueId, detalle?)`: ahora puede anexar `focus` y `ids`
 * para que el tab destino haga scroll, resalte y prefiltre la fila exacta.
 *
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
  ruta: ((embarqueId: string, detalle?: unknown) => string) | null;
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
  const total = Number(pick(d, "total") ?? 0);
  const pagado = Number(pick(d, "pagado") ?? 0);
  const saldo = total - pagado;
  const facturas = pick(d, "facturas_pendientes");
  const partes: string[] = [];
  if (Number(facturas) > 0) partes.push(`${facturas} factura(s) por cobrar`);
  if (saldo > 0.01) partes.push(`saldo ${fmtMoney(saldo)}`);
  return partes.length > 0 ? partes.join(" · ") : null;
};

const fmtCxp = (d: unknown): string | null => {
  const total = Number(pick(d, "total") ?? 0);
  const pagado = Number(pick(d, "pagado") ?? 0);
  const saldo = total - pagado;
  const facturas = pick(d, "facturas_pendientes");
  const partes: string[] = [];
  if (Number(facturas) > 0) partes.push(`${facturas} factura(s) de proveedor por pagar`);
  if (saldo > 0.01) partes.push(`monto ${fmtMoney(saldo)}`);
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
  const utilidad = pick(d, "utilidad");
  const minimo = pick(d, "minimo");
  if (utilidad != null && minimo != null) {
    return `Utilidad actual ${fmtMoney(utilidad)} (mínimo ${fmtMoney(minimo)})`;
  }
  return null;
};

const fmtVentaPendientes = (d: unknown): string | null => {
  const p = Number(pick(d, "pendientes") ?? 0);
  const ep = Number(pick(d, "en_proforma") ?? 0);
  const partes: string[] = [];
  if (p > 0) partes.push(`${p} concepto(s) pendiente(s)`);
  if (ep > 0) partes.push(`${ep} en proforma sin facturar`);
  return partes.length > 0 ? partes.join(" · ") : null;
};

const fmtSinFactura = (d: unknown): string | null => {
  const n = Number(pick(d, "sin_factura") ?? pick(d, "pendientes") ?? 0);
  if (n > 0) return `${n} concepto(s) sin factura de proveedor`;
  return null;
};

const fmtPendientesLiq = (d: unknown): string | null => {
  const n = Number(pick(d, "pendientes") ?? 0);
  if (n > 0) return `${n} concepto(s) por liquidar al proveedor`;
  return null;
};

const fmtContenedores = (d: unknown): string | null => {
  const sin = Number(pick(d, "contenedores_incompletos") ?? pick(d, "sin_datos") ?? 0);
  if (sin > 0) return `${sin} contenedor(es) sin peso/volumen`;
  return null;
};

/** Construye una ruta con tab + focus opcionales. */
const buildRuta = (
  tab: string,
  focus?: string,
  extras?: Record<string, string | undefined>,
) => (id: string, _detalle?: unknown): string => {
  const params = new URLSearchParams({ tab });
  if (focus) params.set("focus", focus);
  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (v) params.set(k, v);
    }
  }
  return `/embarques/${id}?${params.toString()}`;
};

/** Versión que extrae `ids` del detalle (para contenedores). */
const rutaContenedores = (id: string, detalle?: unknown): string => {
  const ids = pick(detalle, "ids");
  const params = new URLSearchParams({ tab: "resumen", focus: "contenedores" });
  if (Array.isArray(ids) && ids.length > 0) {
    params.set("ids", ids.map(String).join(","));
  }
  return `/embarques/${id}?${params.toString()}`;
};

/**
 * Tabla principal. Acepta variantes de nombre (la RPC ha cambiado entre versiones).
 */
const META: Record<string, CierreCheckMeta> = {
  cxc_sin_pendientes: {
    label: "Cuentas por cobrar al día",
    responsable: "Cobranza",
    ruta: buildRuta("facturacion", "cxc"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtCxc,
  },
  cxc_cobrada: {
    label: "Cuentas por cobrar al día",
    responsable: "Cobranza",
    ruta: buildRuta("facturacion", "cxc"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtCxc,
  },
  cxp_sin_pendientes: {
    label: "Cuentas por pagar al día",
    responsable: "Tesorero",
    ruta: buildRuta("costos", "cxp"),
    ctaLabel: "Ir a Costos",
    formatDetalle: fmtCxp,
  },
  cxp_pagada: {
    label: "Cuentas por pagar al día",
    responsable: "Tesorero",
    ruta: buildRuta("costos", "cxp"),
    ctaLabel: "Ir a Costos",
    formatDetalle: fmtCxp,
  },
  documentos_completos: {
    label: "Documentos requeridos completos",
    responsable: "Coordinador logístico",
    ruta: buildRuta("documentos", "faltantes"),
    ctaLabel: "Ir a Documentos",
    formatDetalle: fmtDocs,
  },
  docs_completos: {
    label: "Documentos requeridos completos",
    responsable: "Coordinador logístico",
    ruta: buildRuta("documentos", "faltantes"),
    ctaLabel: "Ir a Documentos",
    formatDetalle: fmtDocs,
  },
  pnl_margen_minimo: {
    label: "Utilidad mínima alcanzada",
    responsable: "Ventas",
    ruta: buildRuta("pnl", "utilidad"),
    ctaLabel: "Ver P&L",
    formatDetalle: fmtMargen,
  },
  comision_calculada: {
    label: "Comisión devengada calculada",
    responsable: "Sistema",
    ruta: buildRuta("pnl", "comision"),
    ctaLabel: "Ver P&L",
    formatDetalle: () => null,
  },
  contenedores_datos_completos: {
    label: "Datos de contenedores capturados (peso y volumen)",
    responsable: "Operador",
    ruta: rutaContenedores,
    ctaLabel: "Ir a Resumen",
    formatDetalle: fmtContenedores,
  },
  venta_conceptos_facturados: {
    label: "Todos los conceptos de venta facturados",
    responsable: "Contador",
    ruta: buildRuta("facturacion", "venta-pendientes"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtVentaPendientes,
  },
  costo_conceptos_con_factura: {
    label: "Todos los costos tienen factura de proveedor recibida",
    responsable: "Auxiliar contable",
    ruta: buildRuta("costos", "costo-sin-factura"),
    ctaLabel: "Ir a Costos",
    formatDetalle: fmtSinFactura,
  },
  costos_liquidados: {
    label: "Todos los costos están liquidados (pagados al proveedor)",
    responsable: "Tesorero",
    ruta: buildRuta("costos", "costo-no-liquidado"),
    ctaLabel: "Ir a Costos",
    formatDetalle: fmtPendientesLiq,
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
