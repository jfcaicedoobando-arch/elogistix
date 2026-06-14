import type { Tables } from "@/integrations/supabase/types";

export type ProformaRow = Tables<"proformas">;
export type ConceptoVentaRow = Tables<"conceptos_venta">;
export type ProformaConceptoConsolidadoRow = Tables<"proforma_conceptos_consolidados">;

export type ProformaConFactura = ProformaRow & {
  facturas: { factura_pdf_url: string | null; factura_xml_url: string | null } | null;
};

/**
 * Forma derivada en cliente (no es columna DB): lista única de los contenedores
 * reales (hijos) a los que apunta esta proforma, calculada en `fetchProformasPendientes`
 * a partir de los `conceptos_venta.contenedor_id` → `embarque_contenedores`.
 * Permite agrupar correctamente embarques con N contenedores en lugar de depender
 * del campo legacy `embarques.contenedor`.
 */
export interface ContenedorRef {
  numero: string | null;
  tipo: string | null;
}

export type ProformaPendienteConEmbarque = ProformaRow & {
  embarques: {
    expediente: string;
    bl_master: string | null;
    cliente_nombre: string;
    contenedor: string | null;
    tipo_contenedor: string | null;
  } | null;
  contenedores_lista?: ContenedorRef[];
};
