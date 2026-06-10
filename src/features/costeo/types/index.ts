/**
 * Tipos del módulo Costeo (tarifas marítimas China → México).
 */

export interface CosteoAgente {
  id: string;
  organization_id: string;
  proveedor_id: string | null;
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
  // joins opcionales
  puerto_origen_nombre?: string;
  puerto_destino_nombre?: string;
}

export type CosteoTarifaEstado = "borrador" | "vigente" | "vencida";

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

export interface TopTarifa {
  tarifa_id: string;
  agente_nombre: string;
  naviera_nombre: string;
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
  moneda: string;
  flete_base: number;
  recargos_total: number;
  total_comparable: number;
  dias_credito: number;
  dias_libres_demoras: number;
  transit_time_dias: number | null;
  vigente_hasta: string;
}
