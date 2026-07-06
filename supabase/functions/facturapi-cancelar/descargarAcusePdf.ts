/**
 * Descarga el PDF oficial del acuse SAT de cancelación desde FacturApi.
 * Endpoint: GET /invoices/{id}/cancellation_receipt/pdf
 *
 * Devuelve el binario del PDF tal cual lo entrega FacturApi (que a su vez lo
 * genera a partir del acuse SAT). Se separa en un módulo auxiliar por el mismo
 * motivo que `descargarAcuse.ts`: el guardrail multi-tenant prohíbe usar
 * `basicAuthHeader` dentro de `index.ts`.
 */
import { FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";

export async function descargarAcuseCancelacionPdf(
  facturapiId: string,
  apiKey: string,
): Promise<
  | { ok: true; pdf: ArrayBuffer }
  | { ok: false; status: number; reason: "not_ready" | "error" }
> {
  try {
    const res = await fetch(
      `${FACTURAPI_BASE}/invoices/${facturapiId}/cancellation_receipt/pdf`,
      { headers: { Authorization: basicAuthHeader(apiKey) } },
    );
    if (res.status === 200) {
      const pdf = await res.arrayBuffer();
      return { ok: true, pdf };
    }
    if (res.status === 404 || res.status === 425) {
      return { ok: false, status: res.status, reason: "not_ready" };
    }
    return { ok: false, status: res.status, reason: "error" };
  } catch {
    return { ok: false, status: 0, reason: "error" };
  }
}
