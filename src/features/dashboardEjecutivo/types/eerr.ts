/** Punto histórico usado por agregación y forecast puro. */
export interface PuntoEERR {
  notas_proveedor_sin_base_count?: number;
  periodo: string;
  ingresos: number;
  costos: number;
  utilidad: number;
}
