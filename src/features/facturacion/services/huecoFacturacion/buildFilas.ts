/**
 * Agregaciones puras (sin I/O) para el "Hueco de Facturación".
 *
 * v13.213.4 — Criterio basado en ETA (llegada) en vez de ETD (salida).
 */
import { sumarConceptosEnMxn, sumarConceptosEnUsd } from "@/features/facturacion/domain/proyeccionFacturacion";
import type { EmbarqueHuecoRow } from "./fetchSources";

export interface FilaHueco {
  embarque_id: string;
  expediente: string;
  cliente_nombre: string;
  operador: string;
  etd: string | null;
  eta: string;
  bl_master: string | null;
  bl_house: string | null;
  diasDesdeEta: number;
  ventaMxn: number;
  ventaUsd: number;
  /** Ola 9 · M5: el embarque no tiene TC capturado; las conversiones valen 0. */
  sin_tc: boolean;
}


export function diasDesde(fechaIso: string, hoy: Date): number {
  const d = new Date(fechaIso + "T00:00:00");
  return Math.floor((hoy.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function indexarVentas(
  rows: { embarque_id: string; total: number | null; moneda: string | null }[],
) {
  const map = new Map<string, { monto: number; moneda: string }[]>();
  for (const v of rows) {
    const list = map.get(v.embarque_id) ?? [];
    list.push({ monto: Number(v.total ?? 0), moneda: String(v.moneda ?? "MXN") });
    map.set(v.embarque_id, list);
  }
  return map;
}

export function construirFilaHueco(
  e: EmbarqueHuecoRow,
  ventasMap: Map<string, { monto: number; moneda: string }[]>,
  hoy: Date,
): FilaHueco | null {
  if (!e.eta) return null;
  // Ola 9 · M5: sin TC capturado NO se asume 1 MXN = 1 USD/EUR. Se marca la
  // fila como `sin_tc` y las conversiones usan 0 para no inventar pesos.
  const tcUsdRaw = Number(e.tipo_cambio_usd ?? 0);
  const tcEurRaw = Number(e.tipo_cambio_eur ?? 0);
  const tcUsd = tcUsdRaw > 0 ? tcUsdRaw : 0;
  const tcEur = tcEurRaw > 0 ? tcEurRaw : 0;
  const ventas = ventasMap.get(e.id) ?? [];
  return {
    embarque_id: e.id,
    expediente: e.expediente ?? "",
    cliente_nombre: e.cliente_nombre ?? "",
    operador: e.operador ?? "",
    etd: e.etd,
    eta: e.eta,
    bl_master: e.bl_master ?? null,
    bl_house: e.bl_house ?? null,
    diasDesdeEta: diasDesde(e.eta, hoy),
    ventaMxn: sumarConceptosEnMxn(ventas, tcUsd, tcEur),
    ventaUsd: sumarConceptosEnUsd(ventas, tcUsd, tcEur),
    sin_tc: tcUsd === 0,
  };
}

