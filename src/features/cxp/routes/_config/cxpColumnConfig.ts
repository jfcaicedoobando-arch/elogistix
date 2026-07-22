/**
 * Configuración de columnas de la tabla /compras/facturas.
 *
 * v13.307.16 — Se consolidan "Estatus + Aprobación + Días + Prog. pago"
 * en la columna única `estado` (chip + micro-chips).  Las claves antiguas
 * (`estatus`, `aprobacion`, `dias`, `programado`) se conservan aquí como
 * alias silenciosos para preferencias persistidas de usuarios existentes;
 * ya no aparecen en el menú "Columnas".
 */
import type { ColumnOption } from "@/components/shared/ColumnVisibilityMenu";

export const CXP_COL_DEFAULTS: Record<string, boolean> = {
  folio_interno: true,
  folio: false,
  proveedor: true,
  emision: false,
  vencimiento: true,
  moneda: false,
  total: true,
  pagado: false,
  saldo: true,
  estado: true,
};

export const CXP_COL_OPTIONS: ColumnOption[] = [
  { id: "folio_interno", label: "Folio", required: true },
  { id: "folio", label: "Folio prov." },
  { id: "proveedor", label: "Proveedor", required: true },
  { id: "emision", label: "Emisión" },
  { id: "vencimiento", label: "Vencimiento" },
  { id: "moneda", label: "Moneda" },
  { id: "total", label: "Total" },
  { id: "pagado", label: "Pagado" },
  { id: "saldo", label: "Saldo", required: true },
  { id: "estado", label: "Estado", required: true },
];
