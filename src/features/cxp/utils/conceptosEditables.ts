/**
 * Reglas de negocio (espejo de la RPC `reemplazar_conceptos_factura_proveedor`)
 * para saber si los conceptos de una factura de proveedor son editables.
 *
 * Sólo son editables las facturas capturadas a mano (sin XML ni UUID fiscal),
 * vivas y sin pagos aplicados: si el desglose vino de un CFDI, es fiscal y se
 * cambia volviendo a adjuntar el XML.
 */

export interface FacturaEditabilidadConceptos {
  uuid_fiscal: string | null;
  archivo_xml_url: string | null;
  estado: string;
  pagado: number;
}

export interface ResultadoEditabilidad {
  puede: boolean;
  /** Motivo en lenguaje claro para el tooltip del botón deshabilitado. */
  motivo: string | null;
}

export function evaluarEdicionConceptos(
  f: FacturaEditabilidadConceptos,
): ResultadoEditabilidad {
  if (f.uuid_fiscal || f.archivo_xml_url) {
    return {
      puede: false,
      motivo:
        "Los conceptos vienen del CFDI del proveedor. Para cambiarlos, vuelve a adjuntar el XML correcto.",
    };
  }
  if (f.estado === "Cancelada") {
    return { puede: false, motivo: "La factura está cancelada." };
  }
  if ((Number(f.pagado) || 0) > 0) {
    return {
      puede: false,
      motivo: "La factura ya tiene pagos aplicados. Elimina los pagos antes de editar los conceptos.",
    };
  }
  return { puede: true, motivo: null };
}
