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
/** Identificador: string no vacío (no exigimos uuid para tolerar fixtures/legacy). */
const id = z.string().min(1);
/** Texto opcional (columnas que en filas legacy pueden no venir en el `select`). */
const textNullish = z.string().nullish();

/** Fila de `cotizacion_costos` (costo/venta por concepto). */
export const costoCotizacionDbSchema = z
  .object({
    id,
    cotizacion_id: id.nullish(),
    concepto: textNullish,
    moneda: textNullish,
    cantidad: moneyNullish,
    costo_unitario: moneyNullish,
    costo_total: moneyNullish,
    precio_venta: moneyNullish,
  })
  .passthrough();

export const costosCotizacionDbSchema = z.array(costoCotizacionDbSchema);

/** Lectura coherente del sello padre y sus costos en un solo snapshot SQL. */
export const cotizacionCostosSnapshotDbSchema = z.object({
  updated_at: z.string().nullable(),
  cotizacion_costos: costosCotizacionDbSchema,
});

/** Concepto de venta persistido en `jsonb` (cotizaciones y proformas). */
export const conceptoVentaDbSchema = z
  .object({
    descripcion: textNullish,
    cantidad: moneyNullish,
    precio_unitario: moneyNullish,
    total: moneyNullish,
    moneda: textNullish,
  })
  .passthrough();

/** Fila ancha de `cotizaciones`: solo identidad + totales + conceptos. */
export const cotizacionRowDbSchema = z
  .object({
    id,
    organization_id: id.nullish(),
    moneda: textNullish,
    total: moneyNullish,
    subtotal: moneyNullish,
    conceptos_venta: z.array(conceptoVentaDbSchema).nullish(),
  })
  .passthrough();

export const cotizacionRowsDbSchema = z.array(cotizacionRowDbSchema);

/** Fila ancha de `proformas` con el join de factura. */
export const proformaRowDbSchema = z
  .object({
    id,
    moneda: textNullish,
    total: moneyNullish,
    subtotal: moneyNullish,
    iva: moneyNullish,
    estado_proforma: textNullish,
  })
  .passthrough();

export const proformaRowsDbSchema = z.array(proformaRowDbSchema);
