/**
 * Construye los datos para el gráfico de barras apiladas de desempeño por operador.
 * Extraído de DesempenoOperadores para separar cómputo del render.
 */
import { useMemo } from "react";
import type { OperadorData, DesgloseEstados } from "@/hooks/useOperacionesData";

export const ESTADOS_KEYS: (keyof DesgloseEstados)[] = [
  "Confirmado",
  "En Tránsito",
  "Llegada",
  "En Proceso",
  "Cerrado",
];

export interface ChartRow {
  nombre: string;
  Confirmado: number;
  "En Tránsito": number;
  Llegada: number;
  "En Proceso": number;
  Cerrado: number;
}

export function useDesempenoChartData(operadores: OperadorData[]): ChartRow[] {
  return useMemo(
    () =>
      operadores.map((op) => ({
        nombre: op.nombre,
        Confirmado: op.desgloseEstados.Confirmado,
        "En Tránsito": op.desgloseEstados["En Tránsito"],
        Llegada: op.desgloseEstados.Llegada,
        "En Proceso": op.desgloseEstados["En Proceso"],
        Cerrado: op.desgloseEstados.Cerrado,
      })),
    [operadores]
  );
}
