/**
 * Lógica pura para construir el gráfico de desempeño por operador.
 * Extraído de useDesempenoChartData para test sin React.
 */
import type { OperadorBase, DesgloseEstados } from "@/types/operaciones";

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

/** "alan.hernandez@elogistixshipping.com" → "Alan Hernandez". */
export function shortNameFromEmail(raw: string): string {
  if (!raw) return "—";
  const local = raw.includes("@") ? raw.split("@")[0] : raw;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export function buildDesempenoChartRows(operadores: OperadorBase[]): ChartRow[] {
  return operadores.map((op) => ({
    nombre: shortNameFromEmail(op.nombre),
    Confirmado: op.desgloseEstados.Confirmado,
    "En Tránsito": op.desgloseEstados["En Tránsito"],
    Llegada: op.desgloseEstados.Llegada,
    "En Proceso": op.desgloseEstados["En Proceso"],
    Cerrado: op.desgloseEstados.Cerrado,
  }));
}
