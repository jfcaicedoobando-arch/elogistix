/**
 * FIX-F964 — Detección de facturas cuyo estado dice "Pagada"/"Parcialmente
 * pagada" sin respaldo (ni pagos ni notas de crédito aplicadas).
 *
 * Vive en su propio módulo (sin componentes) para no romper fast-refresh en
 * `FacturaEstadoInconsistenteAlert.tsx`.
 */
export interface EstadoInconsistenteInput {
  isLoading: boolean;
  estadoFactura?: string;
  pagosCount: number;
  notasAplicadasCount: number;
}

export function esEstadoInconsistente({
  isLoading,
  estadoFactura,
  pagosCount,
  notasAplicadasCount,
}: EstadoInconsistenteInput): boolean {
  return (
    !isLoading &&
    (estadoFactura === "Pagada" || estadoFactura === "Parcialmente pagada") &&
    pagosCount === 0 &&
    notasAplicadasCount === 0
  );
}
