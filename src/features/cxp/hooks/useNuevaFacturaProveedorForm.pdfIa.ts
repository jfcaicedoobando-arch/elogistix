/**
 * Helper para procesar una factura PDF procesada por IA (proveedores
 * internacionales sin XML CFDI). Espejo de `procesarCfdiParsed` pero sin
 * validación de cuadre fiscal — los PDFs de proveedores internacionales
 * no cumplen las reglas de IVA por concepto del CFDI 4.0 mexicano.
 *
 * La UI SIEMPRE muestra los campos prellenados en modo edición para que el
 * usuario los revise y corrija antes de guardar.
 */
import type { CfdiParsedResponse, CfdiConceptoParsed } from "@/features/cxp/services";
import { findProveedorByRfcEnOrg } from "@/features/proveedor/services";
import type { FacturaFormValues } from "@/features/cxp/types";
import type { TcOrigen } from "@/features/cxp/types";
import { mapCfdiToValues, type PendingCfdi } from "./useNuevaFacturaProveedorForm.helpers";

export interface ProcesarPdfIaResult {
  values: FacturaFormValues;
  pendingCfdi: PendingCfdi;
  tcOrigen: TcOrigen;
  tcFechaAplicada?: string;
  askCrearProv: { rfc: string; nombre: string } | null;
  conceptos: CfdiConceptoParsed[];
}

export async function procesarPdfIaParsed(
  data: CfdiParsedResponse,
  files: { pdf: File },
  organizationId: string | null,
): Promise<ProcesarPdfIaResult> {
  const c = data.cfdi;

  // Lookup opcional por tax_id / RFC — para proveedores internacionales
  // suele coincidir con el campo `rfc` guardado como Tax ID internacional.
  let provId = "";
  let provNombre = c.emisor.nombre;
  let askCrearProv: { rfc: string; nombre: string } | null = null;
  if (c.emisor.rfc) {
    try {
      const found = await findProveedorByRfcEnOrg(c.emisor.rfc, organizationId);
      if (found) { provId = found.id; provNombre = found.nombre; }
      else askCrearProv = { rfc: c.emisor.rfc, nombre: c.emisor.nombre };
    } catch { /* opcional */ }
  }

  const values = mapCfdiToValues(data, provId, provNombre);
  const pendingCfdi: PendingCfdi = {
    uuid: "",                          // PDF-IA no tiene UUID fiscal SAT
    rfcEmisor: c.emisor.rfc || "",
    xmlFile: null,                     // sin XML — sólo PDF
    pdfFile: files.pdf,
    origen: "pdf_ia",
  };

  const usaTcIa = c.moneda !== "MXN" && Number(c.tipo_cambio) > 0;
  return {
    values,
    pendingCfdi,
    tcOrigen: usaTcIa ? "manual" : "vacio",  // el usuario debe revisarlo
    tcFechaAplicada: undefined,
    askCrearProv,
    conceptos: c.conceptos ?? [],
  };
}
