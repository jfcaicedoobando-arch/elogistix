/** Presupuesto comercial mensual, independiente del servicio de persistencia. */
import type { Moneda } from "@/types/db";

export interface PresupuestoMes {
  id: string;
  anio: number;
  mes: number;
  monto: number;
  moneda: Moneda;
}
