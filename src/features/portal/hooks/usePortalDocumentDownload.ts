import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { useState, useCallback } from "react";
import { createDocumentoSignedUrl } from "@/features/search/services";
import { notifyError } from "@/lib/ui/appFeedback";
import { descargarBlob } from "@/lib/downloadBlob";

/**
 * Encapsula la descarga de documentos del portal (signed URL + blob fallback).
 */
export function usePortalDocumentDownload() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = useCallback(async (archivo: string, docId: string) => {
    setDownloadingId(docId);
    try {
      const signedUrl = await createDocumentoSignedUrl(archivo, 300);
      const filename = archivo.split("/").pop() || "documento";
      try {
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        descargarBlob(blob, filename);
      } catch {
        window.open(signedUrl, "_blank");
      }
    } catch {
      notifyError(undefined, { title: "Error al descargar", method: "USE_PORTAL_DOCUMENT_DOWNLOAD", errorCode: ERROR_CODES.VALIDATION_FAILED });
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return { downloadingId, handleDownload };
}
