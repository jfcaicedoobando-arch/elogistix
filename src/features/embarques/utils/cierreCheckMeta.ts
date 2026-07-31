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
import type { FaseCierreId } from "./cierreCheckFases";

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
  /** v13.361.0 — Fase del ciclo de vida del embarque a la que pertenece. */
  fase: FaseCierreId;
  /** v13.361.0 — Orden dentro de la fase. */
  orden: number;
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

const cxc: CierreCheckMeta = { label: "Cuentas por cobrar al día", responsable: "Cobranza", ruta: buildRuta("facturacion", "cxc"), ctaLabel: "Ir a Facturación", formatDetalle: fmtCxc, fase: "cobranza", orden: 1 };
const cxp: CierreCheckMeta = { label: "Cuentas por pagar al día", responsable: "Tesorero", ruta: buildRuta("costos", "cxp"), ctaLabel: "Ir a Costos", formatDetalle: fmtCxp, fase: "cobranza", orden: 2 };
const docs: CierreCheckMeta = { label: "Documentos requeridos completos", responsable: "Coordinador logístico", ruta: buildRuta("documentos", "faltantes"), ctaLabel: "Ir a Documentos", formatDetalle: fmtDocs, fase: "documentos", orden: 1 };

const META: Record<string, CierreCheckMeta> = {
  cxc_sin_pendientes: cxc,
  cxc_cobrada: cxc,
  cxp_sin_pendientes: cxp,
  cxp_pagada: cxp,
  documentos_completos: docs,
  docs_completos: docs,
  // v13.347.0 — Buzón CxP fusionado en la pestaña Costos.
  facturas_entrantes_capturadas: {
    label: "Facturas del buzón capturadas", responsable: "Auxiliar contable",
    ruta: buildRuta("costos", "facturas-entrantes"), ctaLabel: "Ir a Costos",
    formatDetalle: fmtEntrantesPendientes, fase: "costos", orden: 1,
  },
  facturas_entrantes_evidencia: {
    label: "Evidencia de factura recibida por proveedor", responsable: "Operador",
    ruta: buildRuta("costos", "facturas-entrantes"), ctaLabel: "Ir a Costos",
    formatDetalle: fmtEntrantesEvidencia, fase: "costos", orden: 2,
  },
  pnl_margen_minimo: {
    label: "Utilidad mínima alcanzada", responsable: "Ventas",
    ruta: buildRuta("pnl", "utilidad"), ctaLabel: "Ver P&L", formatDetalle: fmtMargen, fase: "rentabilidad", orden: 1,
  },
  comision_calculada: {
    label: "Comisión devengada calculada", responsable: "Sistema",
    ruta: buildRuta("pnl", "comision"), ctaLabel: "Ver P&L", formatDetalle: () => null, fase: "rentabilidad", orden: 3,
  },
  contenedores_datos_completos: {
    label: "Datos de contenedores capturados (peso y volumen)", responsable: "Operador",
    ruta: rutaContenedores, ctaLabel: "Ir a Resumen", formatDetalle: fmtContenedores, fase: "operacion", orden: 1,
  },
  contenedores_fechas_completas: {
    label: "Fechas de descarga y devolución capturadas", responsable: "Operador",
    ruta: rutaContenedores, ctaLabel: "Ir a Resumen", formatDetalle: fmtContenedoresFechas, fase: "operacion", orden: 2,
  },
  venta_conceptos_facturados: {
    label: "Todos los conceptos de venta facturados", responsable: "Contador",
    ruta: buildRuta("facturacion", "venta-pendientes"), ctaLabel: "Ir a Facturación",
    formatDetalle: fmtVentaPendientes, fase: "facturacion", orden: 1,
  },
  costo_conceptos_con_factura: {
    label: "Todos los costos tienen factura de proveedor recibida", responsable: "Auxiliar contable",
    ruta: buildRuta("costos", "costo-sin-factura"), ctaLabel: "Ir a Costos",
    formatDetalle: fmtSinFactura, fase: "costos", orden: 3,
  },
  // v13.90.8 — `costos_liquidados` se eliminó del RPC: la liquidación ahora se deriva
  // automáticamente desde `pagos_proveedor` y queda cubierta por la regla `cxp_pagada`.
  rep_pendientes: {
    label: "Complementos de Pago (REP) timbrados",
    responsable: "Contador",
    ruta: buildRuta("facturacion", "rep-pendientes"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtRepPendientes,
    fase: "facturacion",
    orden: 2,
  },
  // B-042: nombres actuales emitidos por validar_cierre_embarque
  // (migración 20260723051800). Los legacy se conservan para caché histórica.
  rep_timbrados: {
    label: "Complementos de Pago (REP) timbrados",
    responsable: "Contador",
    ruta: buildRuta("facturacion", "rep-pendientes"),
    ctaLabel: "Ir a Facturación",
    formatDetalle: fmtRepPendientes,
    fase: "facturacion",
    orden: 2,
  },
  comisiones_definitivas: {
    label: "Comisiones devengadas definitivas",
    responsable: "Sistema",
    ruta: buildRuta("pnl", "comision"),
    ctaLabel: "Ver P&L",
    formatDetalle: fmtComisionesNoDefinitivas,
    fase: "rentabilidad",
    orden: 4,
  },
  margen_minimo: {
    label: "Margen mínimo alcanzado",
    responsable: "Ventas",
    ruta: buildRuta("pnl", "utilidad"),
    ctaLabel: "Ver P&L",
    formatDetalle: fmtMargenMinimoPct,
    fase: "rentabilidad",
    orden: 2,
  },
};

const FALLBACK: CierreCheckMeta = {
  label: "Validación pendiente",
  responsable: "Sistema",
  ruta: null,
  ctaLabel: "",
  // v13.320.36 (B-042) — Nunca exponer JSON crudo al usuario en el checklist.
  formatDetalle: () => null,
  fase: "otros",
  orden: 99,
};

export function getCierreCheckMeta(regla: string): CierreCheckMeta {
  return META[regla] ?? { ...FALLBACK, label: regla };
}
