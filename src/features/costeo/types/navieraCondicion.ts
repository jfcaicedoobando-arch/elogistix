/**
 * Tipos: condiciones por naviera y tabulador escalonado de demoras.
 */
import { hoyMx } from "@/lib/date/mx";

export interface CosteoNavieraCondicion {
  id: string;
  organization_id: string;
  naviera_id: string;
  proveedor_id: string;
  tiene_carta_garantia: boolean;
  carta_garantia_vigente_hasta: string | null;
  carta_garantia_folio: string | null;
  carta_garantia_notas: string | null;
  dias_libres_demoras_default: number;
  moneda_demoras: string;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemorasTramo {
  id: string;
  naviera_condicion_id: string;
  tipo_contenedor_id: string;
  desde_dia: number;
  hasta_dia: number | null;
  monto_por_dia: number;
  moneda: string;
  created_at?: string;
  updated_at?: string;
}

export interface NavieraCondicionInput {
  naviera_id: string;
  proveedor_id: string;
  tiene_carta_garantia: boolean;
  carta_garantia_vigente_hasta: string | null;
  carta_garantia_folio: string | null;
  carta_garantia_notas: string | null;
  dias_libres_demoras_default: number;
  moneda_demoras: string;
  notas: string | null;
}

export interface DemorasTramoInput {
  tipo_contenedor_id: string;
  desde_dia: number;
  hasta_dia: number | null;
  monto_por_dia: number;
  moneda: string;
}

/** Estado de la carta garantía respecto a una fecha de referencia. */
export type CartaGarantiaEstado = "sin_carta" | "vigente" | "por_vencer" | "vencida";

export function calcularEstadoCartaGarantia(
  tiene: boolean,
  vigenteHasta: string | null,
  hoy: Date = new Date(),
): CartaGarantiaEstado {
  if (!tiene || !vigenteHasta) return "sin_carta";
  const venceMs = new Date(vigenteHasta + "T00:00:00").getTime();
  const hoyMs = new Date(hoyMx(hoy) + "T00:00:00").getTime();
  if (venceMs < hoyMs) return "vencida";
  const diff = (venceMs - hoyMs) / (1000 * 60 * 60 * 24);
  return diff <= 30 ? "por_vencer" : "vigente";
}
