/** Contrato de concepto de cotización usado por cálculos puros y el feature. */
export interface ConceptoVentaCotizacion {
  /** Identificador estable cuando el concepto viene de una tabla (opcional en jsonb). */
  id?: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  moneda: string;
  total: number;
  aplica_iva: boolean;
  /**
   * Tasa de IVA explícita de la fila (0 / 0.08 / 0.16). Cuando está presente
   * tiene prioridad sobre el flag `aplica_iva` al calcular totales y payloads.
   * Opcional para soportar cotizaciones legacy persistidas en jsonb.
   */
  tasa_iva_aplicada?: number;
  /**
   * Tratamiento fiscal explícito del renglón heredado del catálogo de
   * productos y servicios. Incluye `no_objeto` (SAT ObjetoImp 01), que NO se
   * puede derivar de `aplica_iva`/`tasa_iva_aplicada`. Ausente en cotizaciones
   * legacy: ahí se sigue resolviendo por tasa/flag.
   */
  tipo_iva?: string;
  notas?: string;
}
