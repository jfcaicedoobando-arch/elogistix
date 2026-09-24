/**
 * P2-8 — combina el estado de la lista con el del resumen de alertas.
 * Con `?alerta=` activo, un fallo de alertas es error de la vista (con
 * reintento), nunca "0 embarques". Sin filtro, la lista manda.
 */
export interface EstadoCargaEntrada {
  alertaFilterActivo: boolean;
  listaLoading: boolean;
  listaError: boolean;
  alertasLoading: boolean;
  alertasError: boolean;
}

export function estadoCargaConAlertas(e: EstadoCargaEntrada): { isLoading: boolean; isError: boolean } {
  const conFiltro = e.alertaFilterActivo;
  return {
    isLoading: e.listaLoading || (conFiltro && e.alertasLoading && !e.alertasError),
    isError: e.listaError || (conFiltro && e.alertasError),
  };
}
