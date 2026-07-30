/**
 * v13.89.2 — Metadatos por regla del checklist de cierre.
 * v13.89.3 — `ruta(embarqueId, detalle?)` puede anexar `focus` y `ids`.
 * v13.89.4 — Formatters movidos a `cierreCheckFormatters.ts`.
 */

import {
  pick,
  fmtCxc, fmtCxp, fmtDocs, fmtMargen, fmtVentaPendientes,
  fmtSinFactura, fmtContenedores, fmtContenedoresFechas, fmtRepPendientes,
  fmtComisionesNoDefinitivas, fmtMargenMinimoPct,
  fmtEntrantesPendientes, fmtEntrantesEvidencia,
} from "./cierreCheckFormatters";

export type ResponsableCierre =
  | "Contador" | "Tesorero" | "Cobranza" | "Auxiliar contable"
  | "Coordinador logístico" | "Operador" | "Ventas" | "Sistema";

export interface CierreCheckMeta {
  label: string;
  responsable: ResponsableCierre;
  /** Ruta destino (relativa a la app) o null si no aplica acción. */
  ruta: ((embarqueId: string, detalle?: unknown) => string) | null;
  ctaLabel: string;
  formatDetalle: (detalle: unknown) => string | null;
}

/** Construye una ruta con tab + focus opcionales. */
const buildRuta = (tab: string, focus?: string) => (id: string, _detalle?: unknown): string => {
  const params = new URLSearchParams({ tab });
  if (focus) params.set("focus", focus);
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

const cxc: CierreCheckMeta = { label: "Cuentas por cobrar al día", responsable: "Cobranza", ruta: buildRuta("facturacion", "cxc"), ctaLabel: "Ir a Facturación", formatDetalle: fmtCxc };
const cxp: CierreCheckMeta = { label: "Cuentas por pagar al día", responsable: "Tesorero", ruta: buildRuta("costos", "cxp"), ctaLabel: "Ir a Costos", formatDetalle: fmtCxp };
const docs: CierreCheckMeta = { label: "Documentos requeridos completos", responsable: "Coordinador logístico", ruta: buildRuta("documentos", "faltantes"), ctaLabel: "Ir a Documentos", formatDetalle: fmtDocs };

const META: Record<string, CierreCheckMeta> = {
  cxc_sin_pendientes: cxc,
  cxc_cobrada: cxc,
  cxp_sin_pendientes: cxp,
  cxp_pagada: cxp,
  documentos_completos: docs,
  docs_completos: docs,
  pnl_margen_minimo: {
    label: "Utilidad mínima alcanzada", responsable: "Ventas",
    ruta: buildRuta("pnl", "utilidad"), ctaLabel: "Ver P&L", formatDetalle: fmtMargen,
  },
  comision_calculada: {
    label: "Comisión devengada calculada", responsable: "Sistema",
    ruta: buildRuta("pnl", "comision"), ctaLabel: "Ver P&L", formatDetalle: () => null,
  },
  contenedores_datos_completos: {
    label: "Datos de contenedores capturados (peso y volumen)", responsable: "Operador",
    ruta: rutaContenedores, ctaLabel: "Ir a Resumen", formatDetalle: fmtContenedores,
  },
  contenedores_fechas_completas: {
    label: "Fechas de descarga y devolución capturadas", responsable: "Operador",
    ruta: rutaContenedores, ctaLabel: "Ir a Resumen", formatDetalle: fmtContenedoresFechas,
  },
  venta_conceptos_facturados: {
    label: "Todos los conceptos de venta facturados", responsable: "Contador",
    ruta: buildRuta("facturacion", "venta-pendientes"), ctaLabel: "Ir a Facturación",
    formatDetalle: fmtVentaPendientes,
  },
  costo_conceptos_con_factura: {
    label: "Todos los costos tienen factura de proveedor recibida", responsable: "Auxiliar contable",
    ruta: buildRuta("costos", "costo-sin-factura"), ctaLabel: "Ir a Costos",
    formatDetalle: fmtSinFactura,
  },
  // v13.90.8 — `costos_liquidados` se eliminó del RPC: la liquidación ahora se deriva
  // automáticamente desde `pagos_proveedor` y queda cubierta por la regla `cxp_pagada`.
  rep_pendientes: {
    label: "Complementos de Pago (REP) timbrados",
    responsable: "Contador",
    ruta: buildRuta("facturacion", "rep-pendientes"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtRepPendientes,
  },
  // B-042: nombres actuales emitidos por validar_cierre_embarque
  // (migración 20260723051800). Los legacy se conservan para caché histórica.
  rep_timbrados: {
    label: "Complementos de Pago (REP) timbrados",
    responsable: "Contador",
    ruta: buildRuta("facturacion", "rep-pendientes"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtRepPendientes,
  },
  comisiones_definitivas: {
    label: "Comisiones devengadas definitivas",
    responsable: "Sistema",
    ruta: buildRuta("pnl", "comision"),
    ctaLabel: "Ver P&L",
    formatDetalle: fmtComisionesNoDefinitivas,
  },
  margen_minimo: {
    label: "Margen mínimo alcanzado",
    responsable: "Ventas",
    ruta: buildRuta("pnl", "utilidad"),
    ctaLabel: "Ver P&L",
    formatDetalle: fmtMargenMinimoPct,
  },
};

const FALLBACK: CierreCheckMeta = {
  label: "Validación pendiente",
  responsable: "Sistema",
  ruta: null,
  ctaLabel: "",
  // v13.320.36 (B-042) — Nunca exponer JSON crudo al usuario en el checklist.
  formatDetalle: () => null,
};

export function getCierreCheckMeta(regla: string): CierreCheckMeta {
  return META[regla] ?? { ...FALLBACK, label: regla };
}
