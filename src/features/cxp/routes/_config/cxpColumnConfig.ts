/**
 * Configuración de columnas de la tabla /compras/facturas.
 *
 * Extraído de `Cxp.tsx` para mantener la ruta bajo el límite Power of 10
 * (200 líneas) y facilitar reutilización en tests.
 *
 * - `CXP_COL_DEFAULTS`: preset por defecto (visibles = true).
 * - `CXP_COL_OPTIONS`: descriptor del menú "Columnas" (con marcadores
 *   `required` para las que no se pueden ocultar).
 */
import type { ColumnOption } from "@/components/shared/ColumnVisibilityMenu";

export const CXP_COL_DEFAULTS: Record<string, boolean> = {
  folio_interno: true,
  folio: false, // Folio prov. (opcional)
  proveedor: true,
  emision: false, // opcional
  vencimiento: true,
  programado: false, // opcional
  dias: true,
  moneda: false, // opcional
  total: true,
  pagado: false, // opcional
  saldo: true,
  estatus: true,
  aprobacion: false, // opcional
};

export const CXP_COL_OPTIONS: ColumnOption[] = [
  { id: "folio_interno", label: "Folio", required: true },
  { id: "folio", label: "Folio prov." },
  { id: "proveedor", label: "Proveedor", required: true },
  { id: "emision", label: "Emisión" },
  { id: "vencimiento", label: "Vencimiento" },
  { id: "programado", label: "Prog. pago" },
  { id: "dias", label: "Días" },
  { id: "moneda", label: "Moneda" },
  { id: "total", label: "Total" },
  { id: "pagado", label: "Pagado" },
  { id: "saldo", label: "Saldo", required: true },
  { id: "estatus", label: "Estatus", required: true },
  { id: "aprobacion", label: "Aprobación" },
];
