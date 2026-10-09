/**
 * Mapper del payload JSONB de `calcular_demoras_embarque` al shape que consume
 * la UI (`DemoraDesglose`).
 *
 * B-097: la RPC devuelve claves distintas a las que esperaba el front
 * (`total_costo`, `contenedores[].dias_excedidos`, sin `dias_excedidos` ni
 * `sin_eventos` a nivel raíz), lo que producía toasts y stats con `undefined`.
 */
import type { DemoraDesglose, DemoraContenedor } from "../types/demoraDesglose";

interface RpcContenedor {
  contenedor_id?: string;
  numero_contenedor?: string | null;
  tipo_contenedor?: string | null;
  fecha_descarga?: string | null;
  fecha_devolucion?: string | null;
  dias_libres?: number | null;
  dias_en_puerto?: number | null;
  dias_excedidos?: number | null;
  monto_costo?: number | null;
  monto_venta_usd?: number | null;
}

export interface RpcDemorasPayload {
  embarque_id?: string;
  error?: string;
  fecha_descarga_embarque?: string | null;
  fecha_devolucion_embarque?: string | null;
  dias_libres_default?: number | null;
  total_costo?: number | null;
  totales_costo_por_moneda?: Record<string, number>;
  moneda_costo?: string | null;
  total_venta_usd?: number | null;
  contenedores?: RpcContenedor[] | null;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const maxBy = (rows: RpcContenedor[], key: keyof RpcContenedor): number =>
  rows.reduce((acc, r) => Math.max(acc, num(r[key])), 0);

function mapContenedores(rows: RpcContenedor[]): DemoraContenedor[] {
  return rows.map((c, i) => ({
    contenedor_id: c.contenedor_id ?? `${i}`,
    numero_contenedor: c.numero_contenedor ?? "—",
    tipo_contenedor: c.tipo_contenedor ?? "—",
    monto_costo_usd: num(c.monto_costo),
    monto_venta_usd: num(c.monto_venta_usd),
  }));
}

function diasLibresDe(rows: RpcContenedor[], fallback: unknown): number {
  return rows.length > 0 ? maxBy(rows, "dias_libres") : num(fallback);
}

/** Las fechas por contenedor son las que el RPC resolvió con su fallback. */
function faltanFechas(rows: RpcContenedor[], descarga: string | null, devolucion: string | null): boolean {
  if (rows.length === 0) return !descarga || !devolucion;
  return rows.some((c) => !(c.fecha_descarga ?? descarga) || !(c.fecha_devolucion ?? devolucion));
}

export function mapDemorasPayload(
  raw: RpcDemorasPayload,
  embarqueId: string,
): DemoraDesglose {
  const rows = Array.isArray(raw?.contenedores) ? raw.contenedores : [];
  const fechaDescarga = raw?.fecha_descarga_embarque ?? null;
  const fechaDevolucion = raw?.fecha_devolucion_embarque ?? null;

  return {
    embarque_id: raw?.embarque_id ?? embarqueId,
    error: raw?.error,
    sin_eventos: faltanFechas(rows, fechaDescarga, fechaDevolucion),
    fecha_descarga: fechaDescarga,
    fecha_devolucion: fechaDevolucion,
    dias_en_puerto: maxBy(rows, "dias_en_puerto"),
    dias_libres: diasLibresDe(rows, raw?.dias_libres_default),
    dias_excedidos: maxBy(rows, "dias_excedidos"),
    total_costo_usd: num(raw?.total_costo),
    totales_costo_por_moneda: raw.totales_costo_por_moneda,
    moneda_costo: raw?.moneda_costo ?? "USD",
    total_venta_usd: num(raw?.total_venta_usd),
    contenedores: mapContenedores(rows),
  };
}
