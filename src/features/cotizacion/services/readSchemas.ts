/**
 * Schemas zod de LECTURA para los boundaries de dinero (M2, auditoría de
 * arquitectura 2026-07-29).
 *
 * No replican las 40-80 columnas de cada tabla: validan el subconjunto crítico
 * (identidad + montos + moneda) y dejan pasar el resto con `.passthrough()`.
 * El objetivo es detectar drift de shape (columna renombrada o eliminada,
 * `jsonb` malformado, monto `null`/`NaN`) con un `ZodError` que trae el path
 * exacto, en lugar de propagar `undefined`/`NaN` silenciosos a las pantallas
 * de totales.
 *
 * Se consumen vía `fromDbChecked(data, schema)` de `@/lib/supabase/cast`.
 */
import { z } from "zod";

/** Monto: número finito (rechaza NaN/Infinity que rompen los totales). */
const money = z.number().finite();
/** Monto opcional: puede faltar o venir nulo en filas legacy. */
const moneyNullish = money.nullish();

/** Fila de `cotizacion_costos` (costo/venta por concepto). */
export const costoCotizacionDbSchema = z
  .object({
    id: z.string().uuid(),
    cotizacion_id: z.string().uuid(),
    concepto: z.string(),
    moneda: z.string(),
    cantidad: money,
    costo_unitario: money,
    costo_total: money,
    precio_venta: moneyNullish,
  })
  .passthrough();

export const costosCotizacionDbSchema = z.array(costoCotizacionDbSchema);

/** Concepto de venta persistido en `jsonb` (cotizaciones y proformas). */
export const conceptoVentaDbSchema = z
  .object({
    descripcion: z.string(),
    cantidad: money,
    precio_unitario: money,
    total: money,
    moneda: z.string(),
  })
  .passthrough();

/** Fila ancha de `cotizaciones`: solo identidad + totales + conceptos. */
export const cotizacionRowDbSchema = z
  .object({
    id: z.string().uuid(),
    organization_id: z.string().uuid().nullish(),
    moneda: z.string().nullish(),
    total: moneyNullish,
    subtotal: moneyNullish,
    conceptos_venta: z.array(conceptoVentaDbSchema).nullish(),
  })
  .passthrough();

export const cotizacionRowsDbSchema = z.array(cotizacionRowDbSchema);

/** Fila ancha de `proformas` con el join de factura. */
export const proformaRowDbSchema = z
  .object({
    id: z.string().uuid(),
    moneda: z.string().nullish(),
    total: moneyNullish,
    subtotal: moneyNullish,
    iva: moneyNullish,
    estado_proforma: z.string().nullish(),
  })
  .passthrough();

export const proformaRowsDbSchema = z.array(proformaRowDbSchema);
