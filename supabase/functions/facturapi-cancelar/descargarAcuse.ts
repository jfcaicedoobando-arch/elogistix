/**
 * Descarga el acuse SAT de cancelación desde FacturApi.
 * Endpoint: GET /invoices/{id}/cancellation_receipt/xml
 *
 * Este helper vive fuera de `index.ts` porque el guardrail
 * `facturapi-multi-tenant.test.ts` prohíbe usar `basicAuthHeader` dentro de la
 * edge function principal. La descarga del acuse no está expuesta por el SDK
 * oficial de FacturApi, así que aquí construimos el header en un módulo
 * auxiliar aislado.
 */
import { FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";

export async function descargarAcuseCancelacion(
  facturapiId: string,
  apiKey: string,
): Promise<{ xml: string | null; status: string }> {
  try {
    const res = await fetch(
      `${FACTURAPI_BASE}/invoices/${facturapiId}/cancellation_receipt/xml`,
      { headers: { Authorization: basicAuthHeader(apiKey) } },
    );
    if (res.status === 200) {
      const xml = await res.text();
      return { xml, status: "accepted" };
    }
    if (res.status === 404 || res.status === 425) {
      // 404 = aún no emitido por SAT; 425 = too early. Se reintenta después.
      return { xml: null, status: "pending" };
    }
    return { xml: null, status: `error_${res.status}` };
  } catch {
    return { xml: null, status: "error_network" };
  }
}
