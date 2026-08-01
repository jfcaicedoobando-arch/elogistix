/**
 * DialogPreviewCfdiPdf — previsualiza el PDF de un CFDI (factura, NC o REP)
 * en un iframe. Descarga los bytes vía el proxy `facturapi-descargar`
 * (mismo camino que `FacturaDownloadButton`) y los renderiza como Blob URL,
 * respetando la papelería configurada en FacturAPI.
 */
import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import {
  descargarCfdiFacturapi,
  fetchCfdiFacturapi,
} from "@/features/facturacion/services/descargarCfdiFacturapi";
import { notifyError } from "@/lib/ui/appFeedback";
import { crearUrlPdf } from "@/lib/pdf/blobPdfUrl";
import { PdfObjectViewer } from "@/components/shared/PdfObjectViewer";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Se debe proveer exactamente uno. */
  facturaId?: string;
  pagoId?: string;
  notaCreditoId?: string;
  /** Título del diálogo. Ej. "Nota de crédito A-25" */
  title: string;
  description?: string;
}

export function DialogPreviewCfdiPdf({
  open,
  onOpenChange,
  facturaId,
  pagoId,
  notaCreditoId,
  title,
  description,
}: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let revoked = false;
    let currentUrl: string | null = null;
    setLoading(true);
    fetchCfdiFacturapi({ tipo: "pdf", facturaId, pagoId, notaCreditoId })
      .then(({ blob }) => {
        if (revoked) return;
        currentUrl = crearUrlPdf(blob);
        setBlobUrl(currentUrl);
      })
      .catch((err) => {
        notifyError(undefined, {
          title: "No se pudo previsualizar el PDF",
          description: (err as Error).message,
          error: err,
          method: "DIALOG_PREVIEW_CFDI_PDF",
        });
        onOpenChange(false);
      })
      .finally(() => {
        if (!revoked) setLoading(false);
      });
    return () => {
      revoked = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      setBlobUrl(null);
    };
  }, [open, facturaId, pagoId, notaCreditoId, onOpenChange]);

  const handleDescargar = async () => {
    try {
      await descargarCfdiFacturapi({ tipo: "pdf", facturaId, pagoId, notaCreditoId });
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo descargar el PDF",
        description: (err as Error).message,
        error: err,
        method: "DIALOG_PREVIEW_CFDI_PDF_DOWNLOAD",
      });
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FileText}
      title={title}
      description={description ?? "Vista previa del CFDI generado por FacturAPI."}
      size="4xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={handleDescargar} disabled={loading}>
            <Download className="h-4 w-4 mr-1" /> Descargar PDF
          </Button>
        </>
      }
    >
      <div className="h-[70vh] w-full rounded-md border bg-muted/20 overflow-hidden flex items-center justify-center">
        {loading || !blobUrl ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Generando vista previa…
          </div>
        ) : (
          <PdfObjectViewer url={blobUrl} title={title} />
        )}
      </div>
    </FormDialogShell>
  );
}
