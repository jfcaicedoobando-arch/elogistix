/**
 * Efectos secundarios "best-effort" del submit de captura de factura de proveedor:
 *  - Subida de XML/PDF al storage de CFDI.
 *  - Vinculación de la factura con conceptos_costo existentes o creación ad-hoc.
 * Extraídos del controller para mantenerlo bajo el límite Power of 10.
 */
import { notifyBestEffortFallo } from "./useNuevaFacturaProveedorForm.bestEffort";

import {
  subirArchivosCfdiFactura,
  vincularFacturaAConceptos,
  crearConceptoCostoYVincular,
  crearAjustesFacturaProveedor,
  insertarConceptosCfdi,
  type CfdiConceptoParsed,
} from "@/features/cxp/services";
import type { FacturaFormValues } from "@/features/cxp/types";
import type { EmbarqueSeleccionado } from "@/features/cxp/types";
import type { PendingCfdi, VinculoLinea } from "./useNuevaFacturaProveedorForm.helpers";
import { registrarAliasProveedor } from "@/features/proveedor/services/matchProveedorPorNombre";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";

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
    notifyBestEffortFallo("Factura guardada pero no se registraron los conceptos del XML", e);
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
    notifyBestEffortFallo("Factura guardada pero el XML/PDF falló", uploadErr);
  }
}

/**
 * Resultado de la vinculación best-effort para que el submit consolide un
 * único toast de éxito (evita doble toast reportado por Karol, 13.219.1).
 */
export interface VincularSafeResult {
  liquidados?: number;
  conceptoAdHocExpediente?: string;
  ajustesCreados?: number;
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
      // v13.303.97: Reflejar diferencias factura vs devengado como ajustes de costo en el embarque.
      let ajustesCreados = 0;
      if (values.provId) {
        try {
          const r = await crearAjustesFacturaProveedor({
            facturaId, organizationId,
            folio: values.folio.trim(),
            fechaEmision: values.emision,
            moneda: values.moneda,
            proveedorId: values.provId,
            proveedorNombre: values.provNombre,
            vinculos,
          });
          ajustesCreados = r.ajustesCreados;
        } catch (ajErr) {
          notifyBestEffortFallo("Factura guardada, pero los ajustes de costo fallaron", ajErr);
        }
      }
      // Fase P.3: la liquidación la determina el trigger en BD a partir de pagos.
      return { liquidados: 0, ajustesCreados };
    } catch (linkErr) {
      notifyBestEffortFallo("Factura guardada, pero el vínculo con embarque falló", linkErr);
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
        // Idempotencia: si el submit se reintenta (doble clic, retry de red)
        // la RPC atómica devuelve el concepto ya creado en vez de duplicarlo.
        clientRequestId: crypto.randomUUID(),
      });
      return { conceptoAdHocExpediente: embarqueAdHoc.expediente };
    } catch (e) {
      notifyBestEffortFallo("Factura guardada, pero no se pudo crear el concepto", e);
      return {};
    }
  }
  return {};
}

export function buildFacturaSuccessDescription(r: VincularSafeResult): string | undefined {
  const parts: string[] = [];
  if (r.liquidados && r.liquidados > 0) {
    parts.push(r.liquidados === 1 ? "1 concepto marcado como pagado" : `${r.liquidados} conceptos marcados como pagados`);
  }
  if (r.conceptoAdHocExpediente) {
    parts.push(`Concepto creado en embarque ${r.conceptoAdHocExpediente}`);
  }
  if (r.ajustesCreados && r.ajustesCreados > 0) {
    parts.push(r.ajustesCreados === 1 ? "1 ajuste aplicado al embarque" : `${r.ajustesCreados} ajustes aplicados al embarque`);
  }
  return parts.length ? parts.join(" · ") : undefined;
}

/**
 * Registra el nombre que el proveedor usa en sus propios documentos como alias,
 * para que la siguiente factura PDF (sin Tax ID impreso) se empareje sola.
 * Nunca rompe el flujo de captura: es un efecto secundario best-effort.
 */
export async function aprenderAliasProveedorSafe(input: {
  values: FacturaFormValues;
  pendingCfdi: PendingCfdi | null;
  organizationId: string | null;
  userId: string | undefined;
}): Promise<void> {
  const nombreDoc = input.pendingCfdi?.nombreEmisorDetectado?.trim();
  if (input.pendingCfdi?.origen !== "pdf_ia" || !nombreDoc || !input.values.provId) return;
  try {
    await registrarAliasProveedor({
      proveedorId: input.values.provId,
      organizationId: input.organizationId,
      nombreDocumento: nombreDoc,
      userId: input.userId ?? null,
    });
  } catch (e) {
    reportCaughtError(e, { feature: "cxp", op: "aprender_alias_proveedor" });
  }
}
