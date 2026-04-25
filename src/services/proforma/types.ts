import type { Tables } from "@/integrations/supabase/types";

export type ProformaRow = Tables<"proformas">;
export type ConceptoVentaRow = Tables<"conceptos_venta">;
export type ProformaConceptoConsolidadoRow = Tables<"proforma_conceptos_consolidados">;

export type ProformaConFactura = ProformaRow & {
  facturas: { factura_pdf_url: string | null; factura_xml_url: string | null } | null;
};

export type ProformaPendienteConEmbarque = ProformaRow & {
  embarques: {
    expediente: string;
    bl_master: string | null;
    cliente_nombre: string;
    contenedor: string | null;
    tipo_contenedor: string | null;
  } | null;
};
