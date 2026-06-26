/**
 * Helper para añadir breadcrumbs de dominio fiscal a Sentry.
 *
 * Cuando un timbrado falla, los breadcrumbs reconstruyen los pasos previos
 * (abrir modal, seleccionar serie, confirmar emisión, recibir respuesta de
 * Facturapi). Dynamic import del SDK para mantener el bundle inicial intacto.
 *
 * v13.137.15 — auditoría de cobertura Sentry post-flujo FacturApi.
 */
export type FiscalOp =
  | "abrir-emitir-factura"
  | "abrir-emitir-rep"
  | "abrir-nota-credito"
  | "abrir-sustituir-cfdi"
  | "abrir-convertir-proforma"
  | "abrir-factura-manual"
  | "facturapi-request"
  | "facturapi-response"
  | "descargar-cfdi"
  | "enviar-cfdi-email"
  | "duplicar-para-sustitucion";

export function addFiscalBreadcrumb(
  op: FiscalOp,
  data?: Record<string, string | number | boolean | null | undefined>,
): void {
  void import("@sentry/react")
    .then(({ addBreadcrumb }) =>
      addBreadcrumb({
        category: "fiscal",
        message: op,
        level: "info",
        data: data ?? {},
      }),
    )
    .catch(() => undefined);
}
