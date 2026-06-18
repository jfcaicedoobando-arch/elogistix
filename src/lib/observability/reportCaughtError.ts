/**
 * Helper para reportar errores capturados en `try/catch` manuales a Sentry,
 * sin acoplar el call site al SDK (usa dynamic import para respetar el
 * ESLint guardrail `no-restricted-imports` de `@sentry/*` estático y para
 * mantener el SDK fuera del bundle inicial).
 *
 * Uso típico (F4 — audit Sentry 13.65.0):
 *
 *   try { ... } catch (err) {
 *     toast.error("Algo salió mal");
 *     reportCaughtError(err, { feature: "facturacion", op: "marcar_enviada" });
 *   }
 *
 * Diseñado para flujos donde el error NO pasa por React Query (que ya tiene
 * cobertura global en `QueryCache.onError`/`MutationCache.onError`).
 */
export interface ReportTags {
  /** Dominio funcional. Ejemplos: facturacion, tesoreria, cotizacion, pnl. */
  feature: string;
  /** Operación específica dentro del feature. Ejemplo: `generar_zip`, `importar_movimientos`. */
  op?: string;
  /** Otros tags opcionales — convierten a string en Sentry. */
  [key: string]: string | undefined;
}

export function reportCaughtError(
  err: unknown,
  tags: ReportTags,
  extra?: Record<string, unknown>,
): void {
  void import("@sentry/react")
    .then(({ captureException }) =>
      captureException(err, { tags: tags as Record<string, string>, extra }),
    )
    .catch(() => undefined);
}
