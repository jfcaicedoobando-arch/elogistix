/**
 * Construye los datos para el gráfico de barras apiladas de desempeño por operador.
 * Extraído de DesempenoOperadores para separar cómputo del render.
 */
import { useMemo } from "react";
import type { OperadorData, DesgloseEstados } from "@/hooks/operaciones/useOperacionesData";

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

/** Convierte "alan.hernandez@elogistixshipping.com" → "Alan Hernandez" */
function shortNameFromEmail(raw: string): string {
  if (!raw) return "—";
  const local = raw.includes("@") ? raw.split("@")[0] : raw;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export function useDesempenoChartData(operadores: OperadorData[]): ChartRow[] {
  return useMemo(
    () =>
      operadores.map((op) => ({
        nombre: shortNameFromEmail(op.nombre),
        Confirmado: op.desgloseEstados.Confirmado,
        "En Tránsito": op.desgloseEstados["En Tránsito"],
        Llegada: op.desgloseEstados.Llegada,
        "En Proceso": op.desgloseEstados["En Proceso"],
        Cerrado: op.desgloseEstados.Cerrado,
      })),
    [operadores]
  );
}
