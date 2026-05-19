/**
 * Adaptador thin para proformas. Mantiene la firma usada por
 * useDescargarProformaPdf y useDialogGenerarProformaController, y elige
 * entre ProformaDocument y ProformaConsolidadaDocument según `es_consolidada`.
 */
import type { Tables } from "@/integrations/supabase/types";
import { TASA_IVA } from "@/lib/financial/financialUtils";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";
import { ProformaConsolidadaDocument } from "@/pdf/documents/ProformaConsolidadaDocument";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import type { EmbarqueLite, ClienteLite } from "@/pdf/documents/proformaShared";

type ProformaRow = Tables<"proformas">;
type ConceptoVenta = Tables<"conceptos_venta">;
type ConceptoConsolidado = Tables<"proforma_conceptos_consolidados">;

interface GenerarPdfProformaParams {
  proforma: ProformaRow;
  embarque: EmbarqueLite;
  conceptos: ConceptoVenta[];
  cliente?: ClienteLite;
  tasaIva?: number;
  conceptosConsolidados?: ConceptoConsolidado[];
}

export function generarPdfProforma(params: GenerarPdfProformaParams): void {
  const { proforma, embarque, cliente, tasaIva = TASA_IVA } = params;
  if (
    params.proforma.es_consolidada &&
    params.conceptosConsolidados &&
    params.conceptosConsolidados.length > 0
  ) {
    void descargarPdf(
      <ProformaConsolidadaDocument
        proforma={proforma}
        embarque={embarque}
        cliente={cliente}
        conceptosConsolidados={params.conceptosConsolidados}
      />,
      `${proforma.numero}-proforma-consolidada`,
    );
    return;
  }
  void descargarPdf(
    <ProformaDocument
      proforma={proforma}
      embarque={embarque}
      conceptos={params.conceptos}
      cliente={cliente}
      tasaIva={tasaIva}
    />,
    `${proforma.numero}-proforma`,
  );
}

export type { EmbarqueLite, ClienteLite };
