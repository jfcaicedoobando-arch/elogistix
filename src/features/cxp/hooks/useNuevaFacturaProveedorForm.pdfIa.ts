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
import {
  buscarProveedorPorNombreEnOrg,
  type MatchOrigen,
} from "@/features/proveedor/services/matchProveedorPorNombre";
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
  /** Cómo se identificó al proveedor; la UI avisa si fue por nombre. */
  matchOrigen: MatchOrigen;
}

/**
 * Resuelve el proveedor en cascada: Tax ID impreso → alias aprendido →
 * nombre normalizado. Muchas facturas asiáticas no imprimen Tax ID, así que
 * sin el respaldo por nombre el proveedor nunca se vincularía solo.
 */
async function resolverProveedor(
  rfc: string,
  nombre: string,
  organizationId: string | null,
): Promise<{ provId: string; provNombre: string; origen: MatchOrigen }> {
  if (rfc) {
    try {
      const found = await findProveedorByRfcEnOrg(rfc, organizationId);
      if (found) return { provId: found.id, provNombre: found.nombre, origen: "tax_id" };
    } catch { /* opcional */ }
  }
  try {
    const { proveedor, origen } = await buscarProveedorPorNombreEnOrg(nombre, organizationId);
    if (proveedor) return { provId: proveedor.id, provNombre: proveedor.nombre, origen };
  } catch { /* opcional */ }
  return { provId: "", provNombre: nombre, origen: "ninguno" };
}

export async function procesarPdfIaParsed(
  data: CfdiParsedResponse,
  files: { pdf: File },
  organizationId: string | null,
): Promise<ProcesarPdfIaResult> {
  const c = data.cfdi;

  const { provId, provNombre, origen } = await resolverProveedor(
    c.emisor.rfc ?? "",
    c.emisor.nombre ?? "",
    organizationId,
  );
  // Sólo ofrecemos crear proveedor si tampoco hubo match por nombre/alias:
  // antes se proponía crear duplicados de proveedores ya existentes.
  const askCrearProv = provId ? null : { rfc: c.emisor.rfc ?? "", nombre: c.emisor.nombre ?? "" };

  const values = mapCfdiToValues(data, provId, provNombre);
  const pendingCfdi: PendingCfdi = {
    uuid: "",                          // PDF-IA no tiene UUID fiscal SAT
    rfcEmisor: c.emisor.rfc || "",
    xmlFile: null,                     // sin XML — sólo PDF
    pdfFile: files.pdf,
    origen: "pdf_ia",
    nombreEmisorDetectado: c.emisor.nombre || "",
  };

  const usaTcIa = c.moneda !== "MXN" && Number(c.tipo_cambio) > 0;
  return {
    values,
    pendingCfdi,
    tcOrigen: usaTcIa ? "manual" : "vacio",  // el usuario debe revisarlo
    tcFechaAplicada: undefined,
    askCrearProv,
    conceptos: c.conceptos ?? [],
    matchOrigen: origen,
  };
}
