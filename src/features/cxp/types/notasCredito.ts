/**
 * Tipos de dominio de notas de crédito de proveedor.
 *
 * La UI importa de aquí en lugar de `@/integrations/supabase/types`, para que un
 * cambio de esquema se absorba en un único punto.
 */
import type { Tables } from "@/types/db";

/** Fila completa de nota de crédito de proveedor. */
export type NotaCreditoProveedor = Tables<"proveedor_notas_credito">;

/** Motivo fiscal de la nota de crédito de proveedor. */
export type MotivoNotaCreditoProveedor = NotaCreditoProveedor["motivo"];

/** Moneda de la nota de crédito de proveedor. */
export type MonedaNotaCreditoProveedor = NotaCreditoProveedor["moneda"];
