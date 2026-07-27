/**
 * useAcuseCancelacion — acciones sobre el acuse SAT de una factura cancelada:
 *  · descargarXml: guarda el XML de acuse como archivo.
 *  · descargarPdf: descarga el PDF OFICIAL emitido por FacturApi
 *    (`/invoices/{id}/cancellation_receipt/pdf`) — ya no generamos un PDF
 *    cliente-side.
 *  · reintentar: mutation que reinvoca `facturapi-cancelar` con
 *    `solo_descargar_acuse: true` para refrescar el acuse XML cuando el SAT
 *    aún no lo había emitido en el momento de la cancelación.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  reintentarAcuseCancelacion,
  descargarAcuseCancelacionPdf,
} from "@/features/facturacion/services/facturapi";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { descargarBlob } from "@/lib/downloadBlob";
import { queryKeys } from "@/lib/query";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";

function nombreArchivoBase(factura: Pick<FacturaDetalle, "numero">): string {
  const safe = factura.numero.replace(/[^A-Za-z0-9._-]+/g, "_");
  return `acuse-cancelacion-${safe}`;
}

export function useAcuseCancelacion(factura: FacturaDetalle | null | undefined) {
  const qc = useQueryClient();

  const reintentar = useMutation({
    mutationKey: queryKeys.facturacion.acuseReintentar(factura?.id),
    mutationFn: () => reintentarAcuseCancelacion(factura!.id),
    onSuccess: (res) => {
      if (res.acuse_guardado) {
        notifySuccess(undefined, {
          title: "Acuse descargado",
          description: "Ya puedes descargar el XML y el PDF del acuse SAT.",
        });
      } else {
        notifySuccess(undefined, {
          title: "Acuse aún no disponible",
          description: "El SAT no ha emitido el acuse todavía. Inténtalo más tarde.",
        });
      }
      qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(factura?.id) });
      invalidateProfitDependencies(qc);
    },
    onError: (err: Error) =>
      notifyError(undefined, {
        title: `No se pudo descargar el acuse: ${err.message}`,
        error: err,
        method: "FEATURES_FACTURACION_HOOKS_USEACUSECANCELACION",
      }),
  });

  function descargarXml() {
    if (!factura?.acuse_cancelacion_xml) {
      notifyError(undefined, {
        title: "Aún no hay acuse SAT disponible.",
        error: new Error("acuse_xml_missing"),
        method: "FEATURES_FACTURACION_HOOKS_USEACUSECANCELACION_XML",
      });
      return;
    }
    const blob = new Blob([factura.acuse_cancelacion_xml], {
      type: "application/xml;charset=utf-8",
    });
    descargarBlob(blob, `${nombreArchivoBase(factura)}.xml`);
  }

  async function descargarPdfAcuse() {
    if (!factura) return;
    try {
      const blob = await descargarAcuseCancelacionPdf(factura.id);
      descargarBlob(blob, `${nombreArchivoBase(factura)}.pdf`);
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo descargar el PDF del acuse.",
        error: err,
        method: "FEATURES_FACTURACION_HOOKS_USEACUSECANCELACION_PDF",
      });
    }
  }

  return {
    descargarXml,
    descargarPdf: descargarPdfAcuse,
    reintentar: () => reintentar.mutate(),
    reintentando: reintentar.isPending,
  };
}
