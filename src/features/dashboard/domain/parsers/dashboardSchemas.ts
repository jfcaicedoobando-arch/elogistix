/**
 * Zod schemas para el payload JSONB de `dashboard_stats()`.
 *
 * Validan runtime los sub-objetos consumidos por los parsers del dashboard.
 * Cualquier cambio en el shape de la RPC se detecta aquí en vez de propagar
 * `NaN`/`undefined` silenciosos al UI.
 *
 * Política: cada schema usa `.passthrough()` para no romper si el backend
 * añade campos. Los parsers consumidores deben hacer `safeParse` y caer al
 * EMPTY_* correspondiente cuando la validación falla — el dashboard prioriza
 * resiliencia visual sobre correctness estricta.
 */
import { z } from "zod";

const numOrCoerce = z.preprocess(
  (v) => (v == null || v === "" ? 0 : v),
  z.coerce.number(),
);

const strOrEmpty = z.preprocess(
  (v) => (v == null ? "" : v),
  z.coerce.string(),
);

export const arribosEsteMesSchema = z
  .object({
    total: numOrCoerce,
    yaLlegaron: numOrCoerce,
    enCamino: numOrCoerce,
    profitUSD: numOrCoerce,
    ventaMXN: numOrCoerce,
    costoMXN: numOrCoerce,
    profitMXN: numOrCoerce,
    ventaMxnFromUsd: numOrCoerce,
    costoMxnFromUsd: numOrCoerce,
    ventaMxnFromEur: numOrCoerce,
    costoMxnFromEur: numOrCoerce,
    ventaMxnNative: numOrCoerce,
    costoMxnNative: numOrCoerce,
    gastosOperativosMXN: numOrCoerce.optional().default(0),
  })
  .passthrough();

export const resumenMesSiguienteSchema = z
  .object({
    totalEmbarques: numOrCoerce,
    ventaUSD: numOrCoerce,
    costoUSD: numOrCoerce,
    profitUSD: numOrCoerce,
    ventaMXN: numOrCoerce,
    costoMXN: numOrCoerce,
    profitMXN: numOrCoerce,
    facturados: numOrCoerce,
    nombreMes: strOrEmpty,
  })
  .passthrough();

const desgloseSchema = z
  .object({
    Confirmado: numOrCoerce.optional().default(0),
    "En Tránsito": numOrCoerce.optional().default(0),
    Arribo: numOrCoerce.optional().default(0),
    "En Aduana": numOrCoerce.optional().default(0),
    Entregado: numOrCoerce.optional().default(0),
  })
  .passthrough();

export const cargaPorClienteSchema = z
  .object({
    clienteId: strOrEmpty.optional(),
    cliente_id: strOrEmpty.optional(),
    clienteNombre: strOrEmpty.optional(),
    cliente_nombre: strOrEmpty.optional(),
    total: numOrCoerce,
    desglose: desgloseSchema.default({
      Confirmado: 0,
      "En Tránsito": 0,
      Arribo: 0,
      "En Aduana": 0,
      Entregado: 0,
    }),
  })
  .passthrough();

