/**
 * Mappers de filas crudas de Supabase → tipos de dominio para el
 * Estado de Resultados Devengado. Centraliza los casts de boundary
 * (categoría MEDIUM por política de cast-audit, aceptable sólo en
 * `lib/mappers/*`) para que `services/estadoResultadosDevengado.ts`
 * quede libre de `as Tables<X>` / `as X[]`.
 */
import { num, str } from "./_helpers";
import type { EmbarqueER } from "@/features/profit/domain/estadoResultados";

export interface FacturaRow {
  id: string;
  expediente: string | null;
  total: number;
  moneda: string;
  fecha_emision: string;
  tipo_cambio: number | null;
}

export interface NotaCreditoRow {
  monto: number;
  moneda: string;
  factura_id: string;
  updated_at: string;
  /** Ola 9 · M6: TC propio de la NC para no revaluar con el TC del mes. */
  tipo_cambio: number | null;
}

export interface ProveedorFacturaRow {
  id: string;
  embarque_id: string | null;
  total: number;
  moneda: string;
  fecha_emision: string;
  tipo_cambio_usd: number | null;
}

type RawRow = Record<string, unknown>;

const nullableNum = (v: unknown): number | null =>
  v === null || v === undefined ? null : num(v);

const nullableStr = (v: unknown): string | null =>
  v === null || v === undefined ? null : str(v);

export function mapFacturaRows(data: unknown): FacturaRow[] {
  return ((data ?? []) as RawRow[]).map((r) => ({
    id: str(r.id),
    expediente: nullableStr(r.expediente),
    total: num(r.total),
    moneda: str(r.moneda),
    fecha_emision: str(r.fecha_emision),
    tipo_cambio: nullableNum(r.tipo_cambio),
  }));
}

export function mapNotaCreditoRows(data: unknown): NotaCreditoRow[] {
  return ((data ?? []) as RawRow[]).map((r) => ({
    monto: num(r.monto),
    moneda: str(r.moneda),
    factura_id: str(r.factura_id),
    updated_at: str(r.updated_at),
    tipo_cambio: r.tipo_cambio == null ? null : num(r.tipo_cambio),
  }));
}

export function mapProveedorFacturaRows(data: unknown): ProveedorFacturaRow[] {
  return ((data ?? []) as RawRow[]).map((r) => ({
    id: str(r.id),
    embarque_id: nullableStr(r.embarque_id),
    total: num(r.total),
    moneda: str(r.moneda),
    fecha_emision: str(r.fecha_emision),
    tipo_cambio_usd: nullableNum(r.tipo_cambio_usd),
  }));
}

export function mapEmbarqueERRows(data: unknown): EmbarqueER[] {
  return ((data ?? []) as RawRow[]).map((r) => ({
    id: str(r.id),
    modo: str(r.modo),
    tipo_cambio_usd: nullableNum(r.tipo_cambio_usd),
    tipo_cambio_eur: nullableNum(r.tipo_cambio_eur),
  }));
}

export function mapEmbarqueERConExpediente(
  data: unknown,
): Array<EmbarqueER & { expediente: string | null }> {
  return ((data ?? []) as RawRow[]).map((r) => ({
    id: str(r.id),
    modo: str(r.modo),
    tipo_cambio_usd: nullableNum(r.tipo_cambio_usd),
    tipo_cambio_eur: nullableNum(r.tipo_cambio_eur),
    expediente: nullableStr(r.expediente),
  }));
}
