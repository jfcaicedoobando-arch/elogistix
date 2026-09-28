import { resumenDocumentoBase as resumen } from "@/lib/documentoResumen";
import type { EstadoDocumentoResumen, PasoDocumento } from "@/lib/documentoResumen";

const PASOS_PROFORMA: PasoDocumento[] = [
  { id: "emitida", label: "Emitida" },
  { id: "enviada", label: "Enviada" },
  { id: "aceptada", label: "Aceptada" },
  { id: "facturada", label: "Facturada" },
];

const PASOS_PROFORMA_INTERNA: PasoDocumento[] = [
  { id: "emitida", label: "Emitida" },
  { id: "aprobacion-interna", label: "Aprobación interna" },
  { id: "facturada", label: "Facturada" },
];

export interface EstadoProformaInput {
  /** Estado de autorización externa o aprobación interna de la proforma. */
  estadoCliente: "pendiente" | "aceptada" | "rechazada";
  /** false when this proforma follows internal approval instead of client authorization. */
  requiereAutorizacion?: boolean;
  /** Fecha en que se envió al cliente, si existe. */
  enviadaAt?: string | null;
  /** true cuando la proforma ya generó factura (aunque siga en preparación). */
  facturada: boolean;
  /**
   * B9: true sólo cuando alguna factura de la proforma ya salió de Borrador /
   * Por timbrar. Si se omite se asume el comportamiento previo (facturada =
   * emitida), para no cambiar superficies que aún no conocen las facturas.
   */
  facturaEmitida?: boolean;
  /** Matiz a mostrar cuando la conversión aún no se emite. */
  etiquetaConversion?: string | null;
}

function resumenProformaInterna(input: EstadoProformaInput): EstadoDocumentoResumen {
  if (input.estadoCliente === "rechazada") return resumen(PASOS_PROFORMA_INTERNA, -1, "Rechazada");
  if (input.facturada) {
    const emitida = input.facturaEmitida ?? true;
    if (emitida) return resumen(PASOS_PROFORMA_INTERNA, 2, null);
    return resumen(PASOS_PROFORMA_INTERNA, 2, null, {
      subEtiqueta: input.etiquetaConversion ?? "Convertida, sin emitir",
    });
  }
  if (input.estadoCliente === "aceptada") return resumen(PASOS_PROFORMA_INTERNA, 1, null);
  return resumen(PASOS_PROFORMA_INTERNA, 1, null);
}

function resumenProformaCliente(input: EstadoProformaInput): EstadoDocumentoResumen {
  if (input.estadoCliente === "rechazada") return resumen(PASOS_PROFORMA, -1, "Rechazada por el cliente");
  // Cuando el cliente ya avanzó (aceptó o se facturó) sin que exista
  // enviadaAt, el paso "Enviada" nunca ocurrió y no debe verse como completado.
  const enviadaOmitida = !input.enviadaAt;
  const pasosOmitidos = enviadaOmitida ? ["enviada"] : [];
  if (input.facturada) {
    const emitida = input.facturaEmitida ?? true;
    if (emitida) return resumen(PASOS_PROFORMA, 3, null, { pasosOmitidos });
    return resumen(PASOS_PROFORMA, 2, null, {
      subEtiqueta: input.etiquetaConversion ?? "Convertida, sin emitir",
      pasosOmitidos,
    });
  }
  if (input.estadoCliente === "aceptada") return resumen(PASOS_PROFORMA, 2, null, { pasosOmitidos });
  if (input.enviadaAt) return resumen(PASOS_PROFORMA, 1, null, { subEtiqueta: "Pendiente del cliente" });
  return resumen(PASOS_PROFORMA, 0, null);
}

export function resumenProforma(input: EstadoProformaInput): EstadoDocumentoResumen {
  return input.requiereAutorizacion === false
    ? resumenProformaInterna(input)
    : resumenProformaCliente(input);
}
