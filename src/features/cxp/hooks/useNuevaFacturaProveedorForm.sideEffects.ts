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
} from "@/features/cxp/services";
import type { FacturaFormValues } from "@/features/cxp/components/facturaFormPrimitives";
import type { EmbarqueSeleccionado } from "@/features/cxp/components/SugerirEmbarqueBlock";
import type { PendingCfdi, VinculoLinea } from "./useNuevaFacturaProveedorForm.helpers";

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

export async function vincularSafe(params: {
  facturaId: string;
  organizationId: string | null;
  values: FacturaFormValues;
  total: number;
  vinculos: Record<string, VinculoLinea>;
  embarqueAdHoc: EmbarqueSeleccionado | null;
}): Promise<void> {
  const { facturaId, organizationId, values, total, vinculos, embarqueAdHoc } = params;
  if (!organizationId) return;

  const lineas = Object.entries(vinculos).map(([conceptoCostoId, v]) => ({
    conceptoCostoId,
    descripcion: v.descripcion,
    monto: v.monto,
    montoOriginal: v.montoOriginal,
  }));

  if (lineas.length > 0) {
    try {
      const res = await vincularFacturaAConceptos({
        facturaId, organizationId,
        folio: values.folio.trim(),
        fechaEmision: values.emision,
        lineas,
      });
      if (res.liquidados.length > 0) {
        toast.success(`${res.liquidados.length} concepto(s) marcados como pagados`);
      }
    } catch (linkErr) {
      const err = linkErr as { message?: string };
      toast.warning(`Factura guardada pero el vínculo con embarque falló: ${err.message ?? "error"}`);
    }
    return;
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
      toast.success(`Concepto creado en embarque ${embarqueAdHoc.expediente}`);
    } catch (e) {
      const err = e as { message?: string };
      toast.warning(`Factura guardada pero no se pudo crear el concepto: ${err.message ?? "error"}`);
    }
  }
}
