/**
 * P0-A/C — Intentos con timbrado PENDIENTE en FacturAPI 5.0.
 *
 * Si la fila local guardó un id remoto pendiente, consultar ESE documento es
 * preferible a paginar listados. Y mientras el remoto siga pendiente, la
 * recuperación NO promueve ni libera el claim: FacturAPI sigue recuperando el
 * timbre (hasta ~50 min) y liberar habilitaría un doble timbrado.
 */
import { jsonResponse } from "../_shared/response.ts";
import { esTimbradoValido, MSG_TIMBRADO_PENDIENTE } from "../_shared/timbradoPendiente.ts";
import { withFacturapiTimeout } from "../_shared/facturapiClient.ts";
import type { FapiInvoice } from "./recuperar.tipos.ts";
import type { BusquedaCfdi } from "./recuperar.ts";

/** Cliente mínimo capaz de consultar un documento por id. */
export interface FapiClientRetrieve {
  invoices: { retrieve?: (id: string) => Promise<FapiInvoice> };
}

/**
 * Consulta directa del intento pendiente. Devuelve `null` cuando no se pudo
 * resolver (SDK sin `retrieve`, timeout o error remoto) para que el llamador
 * caiga al barrido por `external_id`.
 */
export async function buscarPorIdPendiente(
  client: FapiClientRetrieve,
  pendienteId: string | null,
): Promise<BusquedaCfdi | null> {
  if (!pendienteId || typeof client.invoices?.retrieve !== "function") return null;
  try {
    const inv = await withFacturapiTimeout(
      "invoices.retrieve",
      client.invoices.retrieve(pendienteId),
    );
    if (!inv) return null;
    return esTimbradoValido(inv)
      ? { kind: "encontrado", invoice: inv }
      : { kind: "pendiente_remoto", invoice: inv };
  } catch {
    return null;
  }
}

/**
 * Respuesta de un intento que sigue sin timbre: nunca se promueve ni se libera
 * el claim. 409 = "no reintentes, el sistema lo verificará".
 */
export function respuestaPendienteRemoto(
  invoice: FapiInvoice | null,
  claimTag: string,
): Response {
  return jsonResponse({
    outcome: "timbrado_pendiente",
    pendiente: true,
    reintentable: false,
    external_id: claimTag,
    facturapi_pendiente_id: invoice?.id ?? null,
    remoto_status: invoice?.status ?? null,
    message: MSG_TIMBRADO_PENDIENTE,
  }, 409);
}
