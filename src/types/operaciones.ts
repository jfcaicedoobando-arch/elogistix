/**
 * Tipos de dominio puros para Operaciones (capa neutra).
 * Definidos aquí para permitir consumo desde `lib/operaciones/*` sin
 * invertir la jerarquía Pages→Hooks→Services→Lib.
 *
 * `hooks/operaciones/useOperacionesData` y `services/operaciones` mantienen
 * sus propios tipos más ricos (incluyen `CargaRiesgo` con dependencias UI).
 * Aquí exponemos sólo el subconjunto estructural que necesita la lógica pura.
 */

export interface DesgloseEstados {
  Confirmado: number;
  "En Tránsito": number;
  Llegada: number;
  "En Proceso": number;
  Cerrado: number;
}

/**
 * Subconjunto estructural mínimo de OperadorData que requiere la lógica pura
 * de gráficos. Aceptamos cualquier objeto con estos dos campos.
 */
export interface OperadorBase {
  nombre: string;
  desgloseEstados: DesgloseEstados;
}
