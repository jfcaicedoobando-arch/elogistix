import type { ValuacionER } from "@/features/profit/domain/valuacion";

/** Punto histórico usado por agregación y forecast puro. */
export interface PuntoEERR {
  valuacion?: ValuacionER;
  /** La RPC operativa histórica aún no entrega evidencia de completitud. */
  valuacion_no_verificada?: boolean;
  notas_proveedor_sin_base_count?: number;
  periodo: string;
  ingresos: number;
  costos: number;
  utilidad: number;
}
