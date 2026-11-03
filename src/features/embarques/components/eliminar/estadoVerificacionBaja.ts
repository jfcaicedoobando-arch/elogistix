interface EstadoConsulta {
  verificationReady: boolean;
  verificationEnabled: boolean;
  isPending: boolean;
  isFetching: boolean;
  error: unknown;
  data: unknown;
}

/** Cached data cannot enable a confirmation while its current check is pending. */
export function estadoVerificacionBaja(query: EstadoConsulta, operacionError: string | null) {
  const verificando = !query.verificationReady || (query.verificationEnabled && (query.isPending || query.isFetching));
  const fallida = !query.verificationEnabled || Boolean(query.error) || !query.data || operacionError !== null;
  return { verificando, fallida, puedeConfirmar: query.verificationEnabled && !verificando && !fallida };
}
