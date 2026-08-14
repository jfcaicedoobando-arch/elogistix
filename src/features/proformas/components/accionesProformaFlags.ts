/**
 * Flags de visibilidad de la barra de acciones de proforma.
 * Puro y testeable; extraído del componente (Power-of-10 ≤200 líneas).
 */
import type { ProformaDetalleFull } from "@/features/proformas/services";

export type EstadoCliente = "pendiente" | "aceptada" | "rechazada";

export function readEstadoCliente(p: ProformaDetalleFull): EstadoCliente {
  // SAFE-CAST: columna nueva; los tipos generados aún no la incluyen.
  const raw = (p as unknown as { estado_cliente?: string }).estado_cliente;
  if (raw === "aceptada" || raw === "rechazada") return raw;
  return "pendiente";
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
