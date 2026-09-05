/**
 * Tipos de las columnas de tarifas — extraídos de `tarifasColumns.tsx`
 * (Power of 10: ≤200 líneas). Sin cambios de forma ni de comportamiento.
 */
import type { CosteoTarifaEstado } from "@/features/costeo/types";

export interface TarifaRow {
  id: string;
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
  agente_nombre: string;
  naviera_nombre: string;
  tipo_contenedor_nombre: string;
  flete_base: number | string;
  recargos_total: number;
  total_comparable: number;
  vigente_desde: string;
  vigente_hasta: string;
  estado: CosteoTarifaEstado;
  estado_aprobacion?: string;
  motivo_rechazo?: string | null;
}

export interface TarifasColumnsDeps {
  mejorPorGrupo: Map<string, number>;
  aprobarPending: boolean;
  reactivarPending: boolean;
  onEditar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onEliminar: (id: string) => void;
  onAprobar: (id: string) => void;
  onRechazar: (id: string) => void;
  onReactivar: (id: string) => void;
}
