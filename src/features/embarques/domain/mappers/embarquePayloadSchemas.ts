/**
 * Zod schemas para validar enums del payload de inserción de embarques.
 *
 * El formulario RHF maneja estos campos como `string`. Antes de enviar a
 * Supabase los validamos runtime para evitar que un valor inválido genere
 * un error críptico de Postgres en lugar de un error claro de validación.
 */
import { z } from "zod";

export const modoEmbarqueSchema = z.enum([
  "Marítimo",
  "Aéreo",
  "Terrestre",
  "Multimodal",
]);

export const tipoOperacionSchema = z.enum([
  "Importación",
  "Exportación",
  "Nacional",
  "Cross Trade",
]);

export const incotermSchema = z.enum([
  "EXW",
  "FOB",
  "CIF",
  "DAP",
  "DDP",
  "FCA",
  "CFR",
  "CPT",
  "CIP",
  "DAT",
  "N/A",
]);

export const tipoServicioMaritimoSchema = z.enum(["FCL", "LCL"]);

export const monedaSchema = z.enum(["MXN", "USD", "EUR"]);

/**
 * Ola 2 · A (YAGNI) — La VENTA sólo se soporta en MXN/USD: la proforma y la
 * factura no tienen rama EUR y un concepto en euros terminaba facturándose en
 * $0. Los COSTOS siguen usando `monedaSchema` (EUR permitido).
 */
export const monedaVentaSchema = z.enum(["MXN", "USD"]);
