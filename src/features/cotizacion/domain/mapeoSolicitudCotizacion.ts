/**
 * Mapeo único Solicitud de Pricing → Cotización (tabla de formatos).
 * Sólo llena campos vacíos de la cotización: nunca pisa lo ya capturado.
 */
import { TIPOS } from "@/constants/wizardConstants";
import { SECTORES } from "@/constants/cotizacionMercancia";

export interface DatosSolicitudMapeo {
  commodity?: string | null;
  imo?: boolean | null;
  estibable?: boolean | null;
  peso?: string | null;
  unidad_medida?: string | null;
  notas?: string | null;
  tipo_operacion?: string | null;
  sector_economico?: string | null;
}

export interface CamposCotizacionDesdeSolicitud {
  descripcionMercancia?: string;
  tipoCarga?: string;
  descripcionAdicional?: string;
  pesoKg?: number;
  notas?: string;
  tipo?: string;
  sectorEconomico?: string;
}

const A_KG: Record<string, number> = { kg: 1, lb: 0.45359237, t: 1000, g: 0.001 };

/** Convierte el peso libre de la solicitud a kg; null si no es un número positivo. */
export function pesoSolicitudAKg(peso?: string | null, unidad?: string | null): number | null {
  const n = Number(String(peso ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  const factor = A_KG[unidad ?? "kg"] ?? 1;
  return Math.round(n * factor * 100) / 100;
}

export function mapearSolicitudACotizacion(s: DatosSolicitudMapeo): CamposCotizacionDesdeSolicitud {
  const r: CamposCotizacionDesdeSolicitud = {};
  if (s.commodity?.trim()) r.descripcionMercancia = s.commodity.trim();
  if (s.imo === true) r.tipoCarga = "Mercancía Peligrosa";
  else if (s.imo === false) r.tipoCarga = "Carga General";
  if (s.estibable === false) r.descripcionAdicional = "No estibable";
  const kg = pesoSolicitudAKg(s.peso, s.unidad_medida);
  if (kg != null) r.pesoKg = kg;
  if (s.notas?.trim()) r.notas = s.notas.trim();
  if (s.tipo_operacion && (TIPOS as readonly string[]).includes(s.tipo_operacion)) r.tipo = s.tipo_operacion;
  if (s.sector_economico && SECTORES.includes(s.sector_economico)) r.sectorEconomico = s.sector_economico;
  return r;
}
