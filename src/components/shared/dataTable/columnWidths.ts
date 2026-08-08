/**
 * Escala canónica de anchos de columna para tablas (`meta.width`).
 *
 * Antes cada módulo inventaba su propio ancho arbitrario (`w-[95px]`,
 * `w-[100px]`, `w-[110px]`, `w-[115px]`… para el mismo tipo de dato), lo que
 * hacía que dos listados con las mismas columnas se vieran distintos.
 * Aquí se define un solo peldaño por *tipo semántico de dato*, de modo que
 * "Folio" mida igual en compras, facturación y embarques.
 *
 * Uso:
 *   meta: { width: COL_W.folio, className: "font-mono text-xs" }
 *   meta: { width: COL_W.monto, align: "right" }
 */
export const COL_W = {
  /** Checkbox / índice / iconos sueltos. */
  micro: "w-[48px]",
  /** Datos ultra cortos: moneda, TC, número de contenedores. */
  tiny: "w-[64px]",
  /** Modo de transporte, tipo de documento corto. */
  short: "w-[88px]",
  /** Fechas DD/MM/AAAA. */
  fecha: "w-[104px]",
  /** Folios internos / expedientes (FP-000123, LC-2026-0001). */
  folio: "w-[112px]",
  /** Badges de estado (Pagada, Pendiente, Cancelada…). */
  estado: "w-[128px]",
  /** Importes con moneda, alineados a la derecha. */
  monto: "w-[128px]",
  /** Nombres cortos: contacto, operador, usuario. */
  nombre: "min-w-[160px]",
  /** Razón social de cliente/proveedor, descripciones. */
  texto: "min-w-[200px]",
  /** Ruta origen → destino. */
  ruta: "min-w-[176px]",
  /** Columna de acciones (menú kebab / botones inline). */
  acciones: "w-[56px]",
} as const;

