/** Tipos compartidos del sugeridor de conciliación bancaria. */
import type { Moneda } from "@/types/db";

export interface Candidato {
  tipo: "cxc" | "cxp";
  pago_id: string;
  fecha: string;
  referencia: string;
  monto: number;
  moneda: string;
  contraparte: string; // cliente o proveedor
  delta_dias: number;
  delta_monto: number;
}

/** Monedas soportadas por el enum `moneda` de la base (alias central). */
export type MonedaSoportada = Moneda;

/** Sugerencias + señal de que la ventana tenía más candidatos que el tope. */
export interface SugerenciasResultado {
  candidatos: Candidato[];
  /** `true` = la lista está recortada; la unicidad NO quedó comprobada. */
  truncado: boolean;
}
