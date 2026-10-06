/**
 * Tipos de dominio de Facturación.
 *
 * Los componentes de UI deben importar de aquí (no de `@/integrations/supabase/types`):
 * así una migración de esquema se absorbe en un solo archivo en lugar de romper pantallas.
 */
import type { Tables, Moneda } from "@/types/db";

export type { Moneda };

/** Fila completa de factura emitida. */
export type Factura = Tables<"facturas">;

/** Campos mínimos para enviar/identificar una factura en UI. */
export type FacturaLite = Pick<
  Factura,
  "id" | "numero" | "cliente_id" | "total" | "moneda"
>;

/** Nota de crédito emitida al cliente. */
export type FacturaNotaCredito = Tables<"factura_notas_credito">;

/** Motivo fiscal de la nota de crédito al cliente. */
export type MotivoNotaCredito = FacturaNotaCredito["motivo"];

/** Moneda de la nota de crédito al cliente. */
export type MonedaNotaCredito = FacturaNotaCredito["moneda"];

export type { FacturaDetalle } from "./detalle";
export type { RefacturacionEventoRaw } from "./refacturacion";

export type { DatosTimbradoPatch } from "./datosFiscales";
export type { FilaHueco } from "./huecoFacturacion";
