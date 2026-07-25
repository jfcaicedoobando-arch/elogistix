/**
 * Adaptador thin para proformas. Mantiene la firma usada por
 * useDescargarProformaPdf y useDialogGenerarProformaController, y elige
 * entre ProformaDocument y ProformaConsolidadaDocument según `es_consolidada`.
 * Carga los datos del emisor desde `configuracion.empresa`.
 */
import type { Tables } from "@/integrations/supabase/types";
import { TASA_IVA } from "@/lib/financial/financialUtils";
// P12: los Documents se importan dinámicamente dentro de la función.
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { cargarEmisorEmpresa } from "@/pdf/emisor";
import { slugifyOrg } from "@/lib/filenames";
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

export async function generarPdfProforma(params: GenerarPdfProformaParams): Promise<void> {
  const { proforma, embarque, cliente, tasaIva = TASA_IVA } = params;
  const emisor = await cargarEmisorEmpresa();
  const orgSlug = slugifyOrg(emisor.razonSocial);
  if (
    params.proforma.es_consolidada &&
    params.conceptosConsolidados &&
    params.conceptosConsolidados.length > 0
  ) {
    const { ProformaConsolidadaDocument } = await import("@/pdf/documents/ProformaConsolidadaDocument");
    await descargarPdf(
      <ProformaConsolidadaDocument
        proforma={proforma}
        embarque={embarque}
        cliente={cliente}
        conceptosConsolidados={params.conceptosConsolidados}
        emisor={emisor}
      />,
      `${orgSlug}_${proforma.numero}-proforma-consolidada`,
    );
    return;
  }
  const { ProformaDocument } = await import("@/pdf/documents/ProformaDocument");
  await descargarPdf(
    <ProformaDocument
      proforma={proforma}
      embarque={embarque}
      conceptos={params.conceptos}
      cliente={cliente}
      tasaIva={tasaIva}
      emisor={emisor}
    />,
    `${orgSlug}_${proforma.numero}-proforma`,
  );
}

export type { EmbarqueLite, ClienteLite };
