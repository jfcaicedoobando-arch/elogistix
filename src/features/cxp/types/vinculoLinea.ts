/** Asignación de costo compartida entre captura y ajustes de factura. */
export interface VinculoLinea {
  embarqueId: string;
  montoOriginal: number;
  descripcion: string;
  monto: number;
  /**
   * Moneda en la que se congelaron `monto` y `montoOriginal` (la de la factura
   * en ese instante). Si después cambia la moneda de la factura, el delta ya no
   * es comparable y no debe convertirse en ajuste de costo: es el bug del
   * "ajuste fantasma" de −953.68 USD en ELIMP00358 (60 USD contra 1,013.68 MXN).
   */
  monedaBase?: string;
}
