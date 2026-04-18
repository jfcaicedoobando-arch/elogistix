import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Encapsula la descarga de documentos del portal (signed URL + blob fallback).
 */
export function usePortalDocumentDownload() {
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = useCallback(async (archivo: string, docId: string) => {
    setDownloadingId(docId);
    try {
      const { data, error } = await supabase.storage
        .from("documentos")
        .createSignedUrl(archivo, 300);
      if (error) throw error;
      const filename = archivo.split("/").pop() || "documento";
      try {
        const response = await fetch(data.signedUrl);
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
        window.open(data.signedUrl, "_blank");
      }
    } catch {
      toast({ title: "Error al descargar", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  }, [toast]);

  return { downloadingId, handleDownload };
}
