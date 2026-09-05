/**
 * Error de regla de negocio lanzado deliberadamente por servicios del cliente
 * (guardas de vigencia, monedas mezcladas, etc.). La UI ya lo muestra en un
 * toast accionable, así que NO debe crear issues en Sentry.
 *
 * Sentry JAVASCRIPT-REACT-61 / -62: estos mensajes llegaban como `Error`
 * genérico y se reportaban como bugs.
 */
export class ReglaNegocioError extends Error {
  /** Marca leída por los filtros de reporte (`expected === true`). */
  readonly expected = true;

  constructor(message: string) {
    super(message);
    this.name = "ReglaNegocioError";
  }
}
