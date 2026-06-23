/**
 * Tipos del módulo Costeo (tarifas marítimas China → México).
 */

export interface CosteoAgente {
  id: string;
  organization_id: string;
  proveedor_id: string;
  nombre: string;
  pais: string;
  dias_credito: number;
  contacto_tarifario: string | null;
  email: string | null;
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface CosteoRuta {
  id: string;
  organization_id: string;
  puerto_origen_id: string;
  puerto_destino_id: string;
  activa: boolean;
  created_at: string;
  updated_at: string;
  puerto_origen_nombre?: string;
  puerto_destino_nombre?: string;
  /** Conteo de tarifas con estado='vigente' y vigente_hasta >= hoy. */
  tarifas_vigentes_count?: number;
  /** Fecha (ISO date) de la tarifa vigente más próxima a vencer. */
  proxima_expiracion?: string | null;
  /** updated_at máximo entre las tarifas vigentes de la ruta. */
  ultima_actualizacion_tarifa?: string | null;
  /** Cantidad de agentes distintos con tarifa vigente en la ruta. */
  proveedores_count?: number;
}


export type CosteoTarifaEstado = "borrador" | "vigente" | "vencida" | "reemplazada";

export interface CosteoTarifa {
  id: string;
  organization_id: string;
  agente_id: string;
  naviera_id: string;
  ruta_id: string;
  tipo_contenedor_id: string;
  moneda: string;
  flete_base: number;
  dias_libres_demoras: number;
  vigente_desde: string;
  vigente_hasta: string;
  transit_time_dias: number | null;
  notas: string | null;
  estado: CosteoTarifaEstado;
  estado_aprobacion?: string;
  motivo_rechazo?: string | null;
  aprobada_por?: string | null;
  aprobada_en?: string | null;
  reemplazada_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface CosteoTarifaRecargo {
  id: string;
  tarifa_id: string;
  concepto: string;
  lado: "origen" | "destino";
  monto: number;
  moneda: string;
  incluido_en_total: boolean;
}

/** Fila enriquecida usada en la tabla del editor de tarifas. */
export interface CosteoTarifaRow extends CosteoTarifa {
  agente_nombre: string;
  naviera_nombre: string;
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
  tipo_contenedor_nombre: string;
  recargos_total: number;
  total_comparable: number;
  recargos: CosteoTarifaRecargo[];
}

/** Fila devuelta por la vista `costeo_tarifas_vigentes_v` / RPC `get_top_tarifas`. */
export interface TopTarifaRow {
  id: string;
  organization_id: string;
  agente_id: string;
  agente_nombre: string;
  dias_credito: number;
  naviera_id: string;
  naviera_nombre: string;
  ruta_id: string;
  puerto_origen_id: string;
  puerto_destino_id: string;
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
  tipo_contenedor_id: string;
  tipo_contenedor_nombre: string;
  moneda: string;
  flete_base: number;
  recargos_total: number;
  total_comparable: number;
  dias_libres_demoras: number;
  transit_time_dias: number | null;
  vigente_desde: string;
  vigente_hasta: string;
  estado: CosteoTarifaEstado;
  naviera_condicion_id: string | null;
  naviera_tiene_carta_garantia: boolean;
  naviera_carta_garantia_vigente_hasta: string | null;
  naviera_carta_garantia_activa: boolean;
  naviera_dias_libres_default: number | null;
  naviera_demora_dia_6: number | null;
  // v13.47.0: heredables al wizard de cotización (ventas solo captura ruta+contenedor).
  dias_libres_almacenaje_lcl: number | null;
  frecuencia_resuelta: string | null;
  naviera_frecuencia: string | null;
  tarifa_frecuencia_override: string | null;
}

export * from "./navieraCondicion";
