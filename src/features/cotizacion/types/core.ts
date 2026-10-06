/**
 * Tipos de dominio para Cotizaciones (capa neutra, sin dependencias UI/hooks).
 * Movido desde src/hooks/cotizacion/useCotizacionTypes.ts para que services/lib/generators
 * puedan importar tipos sin invertir la jerarquía de capas.
 *
 * El barrel `@/hooks/cotizacion/useCotizaciones` los re-exporta para preservar la API pública.
 */
import type { Tables } from '@/integrations/supabase/types';

import type { ConceptoVentaCotizacion } from "@/types/cotizacionConceptos";
export type { ConceptoVentaCotizacion } from "@/types/cotizacionConceptos";
export interface DimensionLCL {
  piezas: number;
  alto_cm: number;
  largo_cm: number;
  ancho_cm: number;
  volumen_m3: number;
}

export interface DimensionAerea {
  piezas: number;
  alto_cm: number;
  largo_cm: number;
  ancho_cm: number;
  peso_volumetrico_kg: number;
}

/** CotizacionRow extiende la tabla generada, sobreescribiendo los campos JSON */
export type CotizacionRow = Omit<Tables<'cotizaciones'>, 'conceptos_venta' | 'dimensiones_lcl' | 'dimensiones_aereas'> & {
  conceptos_venta: ConceptoVentaCotizacion[];
  dimensiones_lcl: DimensionLCL[];
  dimensiones_aereas: DimensionAerea[];
};

export interface CreateCotizacionInput {
  cliente_id?: string | null;
  cliente_nombre: string;
  es_prospecto: boolean;
  prospecto_empresa?: string;
  prospecto_contacto?: string;
  prospecto_email?: string;
  prospecto_telefono?: string;
  modo: string;
  tipo: string;
  incoterm: string;
  descripcion_mercancia: string;
  peso_kg: number;
  /** Peso físico aéreo explícito; null significa que no fue capturado. */
  peso_fisico_kg?: number | null;
  volumen_m3: number;
  piezas: number;
  origen: string;
  destino: string;
  /** Etapa 3 — identidad exacta del puerto de catálogo (sólo marítimo). */
  puerto_origen_id?: string | null;
  puerto_destino_id?: string | null;

  conceptos_venta: ConceptoVentaCotizacion[];
  subtotal: number;
  moneda: string;
  vigencia_dias: number;
  notas: string;
  operador: string;
  tipo_carga?: string;
  msds_archivo?: string | null;
  tipo_embarque?: string;
  tipo_contenedor?: string | null;
  tipo_peso?: string;
  descripcion_adicional?: string;
  sector_economico?: string;
  dimensiones_lcl?: DimensionLCL[];
  /** B-092: parámetros del flete LCL manual (W/M) persistidos en columnas `lcl_*`. */
  lcl_tarifa_wm?: number | null;
  lcl_minimo_flete?: number | null;
  lcl_dias_libres_almacenaje?: number | null;
  lcl_consolidador_id?: string | null;
  dimensiones_aereas?: DimensionAerea[];
  dias_libres_destino?: number;
  dias_almacenaje?: number;
  tiempo_transito_dias?: number | null;
  frecuencia?: string;
  ruta_texto?: string;
  validez_propuesta?: string | null;
  tipo_movimiento?: string;
  seguro?: boolean;
  valor_seguro_usd?: number;
  carta_garantia?: boolean;
  num_contenedores?: number;
  /** Descripción de la unidad cotizada para transporte terrestre. */
  tipo_unidad?: string | null;
  modalidad_equipo?: string | null;
  punto_intermedio?: string | null;
  tarifa_id?: string | null;
  tarifa_override?: Record<string, boolean>;
  agente_id?: string | null;
  agente_nombre?: string | null;
  naviera_id?: string | null;
  naviera_nombre?: string | null;
}
