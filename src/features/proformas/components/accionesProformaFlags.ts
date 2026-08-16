/**
 * Flags de visibilidad de la barra de acciones de proforma.
 * Puro y testeable; extraído del componente (Power-of-10 ≤200 líneas).
 */
import type { ProformaDetalleFull } from "@/features/proformas/services";
import {
  resolveEstadoCliente,
  type EstadoClienteProforma,
} from "@/features/proformas/domain/proformaClienteEstado";

export type EstadoCliente = EstadoClienteProforma;

export function readEstadoCliente(p: ProformaDetalleFull): EstadoCliente {
  return resolveEstadoCliente(p.estado_cliente);
}


export function computarFlags(
  proforma: ProformaDetalleFull,
  canEmitirFactura: boolean,
  canResponderProformaManual: boolean,
) {
  const facturada = (proforma.estado_proforma ?? "pendiente") === "facturada";
  const estadoCliente = readEstadoCliente(proforma);
  const clienteAcepto = estadoCliente === "aceptada";
  return {
    facturada,
    puedeConvertir:
      clienteAcepto && !facturada && !proforma.factura_id && canEmitirFactura,
    puedeResponder:
      !facturada && estadoCliente === "pendiente" && canResponderProformaManual,
    mostrarHint: !clienteAcepto && !facturada,
  };
}
