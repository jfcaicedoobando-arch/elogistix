import type { Tables } from '@/integrations/supabase/types';

export interface ConceptoVentaCotizacion {
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  moneda: string;
  total: number;
  aplica_iva: boolean;
}

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
  volumen_m3: number;
  piezas: number;
  origen: string;
  destino: string;
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
}
