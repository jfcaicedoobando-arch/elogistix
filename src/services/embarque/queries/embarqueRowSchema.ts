/**
 * Zod schema para validar las filas devueltas por Supabase al exportar
 * el listado de embarques (EMBARQUE_LIST_COLUMNS). Usa `.passthrough()`
 * para tolerar columnas adicionales que añada el backend en el futuro.
 *
 * Pensado como red de seguridad en el boundary: si el shape cambia
 * silenciosamente, la export CSV falla con un error claro en vez de
 * generar un CSV corrupto.
 */
import { z } from "zod";

const nullableStr = z.string().nullable().optional();
const nullableNum = z.number().nullable().optional();

export const embarqueListRowSchema = z
  .object({
    id: z.string(),
    expediente: z.string().nullable(),
    cliente_id: z.string().nullable(),
    cliente_nombre: z.string().nullable(),
    modo: z.string(),
    estado: z.string().nullable(),
    etd: nullableStr,
    eta: nullableStr,
    operador: z.string().nullable(),
    tipo: z.string().nullable(),
    created_at: z.string(),
    tipo_cambio_usd: nullableNum,
    tipo_cambio_eur: nullableNum,
    tiene_proforma: z.boolean().nullable().optional(),
  })
  .passthrough();

export const embarqueListRowsSchema = z.array(embarqueListRowSchema);
