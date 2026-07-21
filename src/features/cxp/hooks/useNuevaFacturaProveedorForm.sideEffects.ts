/**
 * Efectos secundarios "best-effort" del submit de captura de factura de proveedor:
 *  - Subida de XML/PDF al storage de CFDI.
 *  - Vinculación de la factura con conceptos_costo existentes o creación ad-hoc.
 * Extraídos del controller para mantenerlo bajo el límite Power of 10.
 */
import { toast } from "sonner";
import {
  subirArchivosCfdiFactura,
  vincularFacturaAConceptos,
  crearConceptoCostoYVincular,
  crearAjustesFacturaProveedor,
  insertarConceptosCfdi,
  type CfdiConceptoParsed,
} from "@/features/cxp/services";
import type { FacturaFormValues } from "@/features/cxp/components/facturaFormPrimitives";
import type { EmbarqueSeleccionado } from "@/features/cxp/components/SugerirEmbarqueBlock";
import type { PendingCfdi, VinculoLinea } from "./useNuevaFacturaProveedorForm.helpers";

/**
 * Persiste los conceptos del XML CFDI como líneas informativas de la factura.
 * Best-effort: si falla, la factura queda guardada y se muestra warning.
 */
export async function persistirConceptosCfdiSafe(params: {
  facturaId: string;
  organizationId: string | null;
  conceptos: ReadonlyArray<CfdiConceptoParsed>;
}): Promise<void> {
  if (!params.organizationId || !params.conceptos.length) return;
  try {
    await insertarConceptosCfdi({
      facturaId: params.facturaId,
      organizationId: params.organizationId,
      conceptos: params.conceptos,
    });
  } catch (e) {
    const err = e as { message?: string };
    toast.warning(`Factura guardada pero no se registraron los conceptos del XML: ${err.message ?? "error"}`);
  }
}

export async function uploadCfdiSafe(params: {
  facturaId: string;
  organizationId: string | null;
  pendingCfdi: PendingCfdi | null;
}): Promise<void> {
  if (!params.pendingCfdi) return;
  try {
    await subirArchivosCfdiFactura({
      facturaId: params.facturaId,
      organizationId: params.organizationId,
      xmlFile: params.pendingCfdi.xmlFile,
      pdfFile: params.pendingCfdi.pdfFile,
    });
  } catch (uploadErr) {
    const err = uploadErr as { message?: string };
    toast.warning(`Factura guardada pero el XML/PDF falló: ${err.message ?? "error"}`);
  }
}

/**
 * Resultado de la vinculación best-effort para que el submit consolide un
 * único toast de éxito (evita doble toast reportado por Karol, 13.219.1).
 */
export interface VincularSafeResult {
  liquidados?: number;
  conceptoAdHocExpediente?: string;
}

export async function vincularSafe(params: {
  facturaId: string;
  organizationId: string | null;
  values: FacturaFormValues;
  total: number;
  vinculos: Record<string, VinculoLinea>;
  embarqueAdHoc: EmbarqueSeleccionado | null;
}): Promise<VincularSafeResult> {
  const { facturaId, organizationId, values, total, vinculos, embarqueAdHoc } = params;
  if (!organizationId) return {};

  const lineas = Object.entries(vinculos).map(([conceptoCostoId, v]) => ({
    conceptoCostoId,
    descripcion: v.descripcion,
    monto: v.monto,
    montoOriginal: v.montoOriginal,
  }));

  if (lineas.length > 0) {
    try {
      await vincularFacturaAConceptos({
        facturaId, organizationId,
        folio: values.folio.trim(),
        fechaEmision: values.emision,
        lineas,
      });
      // Fase P.3: la liquidación la determina el trigger en BD a partir de pagos.
      return { liquidados: 0 };
    } catch (linkErr) {
      const err = linkErr as { message?: string };
      toast.warning(`Factura guardada pero el vínculo con embarque falló: ${err.message ?? "error"}`);
      return {};
    }
  }

  if (embarqueAdHoc && values.provId) {
    try {
      await crearConceptoCostoYVincular({
        facturaId, organizationId,
        embarqueId: embarqueAdHoc.embarqueId,
        proveedorId: values.provId,
        proveedorNombre: values.provNombre,
        concepto: embarqueAdHoc.concepto || `Servicios ${values.provNombre}`,
        monto: total,
        moneda: values.moneda,
        folio: values.folio.trim(),
        fechaEmision: values.emision,
      });
      return { conceptoAdHocExpediente: embarqueAdHoc.expediente };
    } catch (e) {
      const err = e as { message?: string };
      toast.warning(`Factura guardada pero no se pudo crear el concepto: ${err.message ?? "error"}`);
      return {};
    }
  }
  return {};
}

export function buildFacturaSuccessDescription(r: VincularSafeResult): string | undefined {
  if (r.liquidados && r.liquidados > 0) {
    return r.liquidados === 1
      ? "1 concepto marcado como pagado"
      : `${r.liquidados} conceptos marcados como pagados`;
  }
  if (r.conceptoAdHocExpediente) {
    return `Concepto creado en embarque ${r.conceptoAdHocExpediente}`;
  }
  return undefined;
}
