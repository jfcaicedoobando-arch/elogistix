import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { createDocumentoSignedUrl } from "@/services/searchService";
import { notifyError } from "@/lib/ui/appFeedback";

/**
 * Encapsula la descarga de documentos del portal (signed URL + blob fallback).
 */
export function usePortalDocumentDownload() {
  const { toast } = useToast();
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
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(signedUrl, "_blank");
      }
    } catch {
      notifyError(toast, { title: "Error al descargar" });
    } finally {
      setDownloadingId(null);
    }
  }, [toast]);

  return { downloadingId, handleDownload };
}
