/**
 * useAcuseCancelacion — acciones sobre el acuse SAT de una factura cancelada:
 *  · descargarXml: guarda el XML de acuse como archivo.
 *  · descargarPdf: genera un PDF cliente-side con los datos de cancelación.
 *  · reintentar: mutation que reinvoca `facturapi-cancelar` con
 *    `solo_descargar_acuse: true` para refrescar el acuse cuando el SAT
 *    aún no lo había emitido en el momento de la cancelación.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reintentarAcuseCancelacion } from "@/features/facturacion/services/facturapi";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { descargarBlob } from "@/lib/downloadBlob";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import {
  AcuseCancelacionDocument,
  type AcuseCancelacionData,
} from "@/pdf/documents/AcuseCancelacionDocument";
import { cargarEmisorEmpresa } from "@/pdf/emisor";
import { queryKeys } from "@/lib/query";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";

function nombreArchivoBase(factura: Pick<FacturaDetalle, "numero">): string {
  const safe = factura.numero.replace(/[^A-Za-z0-9._-]+/g, "_");
  return `acuse-cancelacion-${safe}`;
}

export function useAcuseCancelacion(factura: FacturaDetalle | null | undefined) {
  const qc = useQueryClient();

  const reintentar = useMutation({
    mutationKey: ["factura", "acuse-reintentar", factura?.id],
    mutationFn: () => reintentarAcuseCancelacion(factura!.id),
    onSuccess: (res) => {
      if (res.acuse_guardado) {
        notifySuccess(toast, {
          title: "Acuse descargado",
          description: "Ya puedes descargar el XML y el PDF del acuse SAT.",
        });
      } else {
        notifySuccess(toast, {
          title: "Acuse aún no disponible",
          description: "El SAT no ha emitido el acuse todavía. Inténtalo más tarde.",
        });
      }
      qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(factura?.id) });
    },
    onError: (err: Error) =>
      notifyError(toast, {
        title: `No se pudo descargar el acuse: ${err.message}`,
        error: err,
        method: "FEATURES_FACTURACION_HOOKS_USEACUSECANCELACION",
      }),
  });

  function descargarXml() {
    if (!factura?.acuse_cancelacion_xml) {
      notifyError(toast, {
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
      const emisor = await cargarEmisorEmpresa().catch(() => undefined);
      const data: AcuseCancelacionData = {
        numero: factura.numero,
        uuidFiscal: factura.uuid_fiscal,
        folioFiscal: factura.folio_fiscal,
        serie: factura.serie,
        clienteNombre: factura.cliente_nombre,
        rfcCliente: factura.rfc_cliente,
        fechaEmision: factura.fecha_emision,
        motivo: factura.cancelacion_motivo,
        canceladoEn: factura.cancelado_en,
        acuseFecha: factura.acuse_cancelacion_fecha,
        acuseStatus: factura.acuse_cancelacion_status,
      };
      await descargarPdf(
        <AcuseCancelacionDocument data={data} emisor={emisor ?? undefined} />,
        nombreArchivoBase(factura),
      );
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo generar el PDF del acuse.",
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
