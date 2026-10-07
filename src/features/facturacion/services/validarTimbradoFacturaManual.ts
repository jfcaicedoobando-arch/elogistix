import { validarFormaMetodoPago } from "@/lib/financial/formaMetodoPago";
import { fetchClienteFiscal } from "./datosFiscalesCliente";
import type { CrearFacturaManualInput } from "./facturaManual";
import { buildChecksTimbrado } from "../utils/validarDatosTimbrado";

/** Sólo Crear y timbrar: vuelve a leer el receptor antes de crear el borrador. */
export async function validarTimbradoFacturaManual(input: CrearFacturaManualInput): Promise<void> {
  const pago = validarFormaMetodoPago(input.formaPago, input.metodoPago);
  if (pago.length) throw new Error(pago.map((i) => i.message).join(" "));
  const cliente = await fetchClienteFiscal(input.clienteId);
  if (!cliente) throw new Error("No se pudieron consultar los datos fiscales del cliente. No se creó la factura.");
  // rfcCliente se guarda como snapshot y es el RFC que enviará la edge.
  const { checks, puedeTimbrar } = buildChecksTimbrado({
    rfc: input.rfcCliente, cp: cliente.codigo_postal ?? "", regimen: cliente.regimen_fiscal ?? "",
    usoCfdi: input.usoCfdi, formaPago: input.formaPago, metodoPago: input.metodoPago,
    moneda: input.moneda, tipoCambio: input.tipoCambio,
  });
  if (!puedeTimbrar) throw new Error(checks.filter((c) => !c.ok).map((c) => c.label).join(" "));
}
