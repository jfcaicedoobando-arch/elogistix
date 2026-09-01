/**
 * Hook para carga y procesamiento por IA de facturas PDF de proveedores
 * internacionales. Espejo de `useCargaCfdi` pero contra `parse-invoice-pdf`.
 */
import { useCallback, useState } from "react";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { parsePdfInvoice } from "@/features/cxp/services/parsePdfInvoice";
import { CfdiUploadError } from "@/features/cxp/services/parseCfdi";
import type { CfdiParsedResponse } from "@/features/cxp/services";
import { notifyError } from "@/lib/ui/appFeedback";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

interface Args {
  categorias: { id: string; nombre: string }[];
  onParsed: (data: CfdiParsedResponse, files: { pdf: File }) => void | Promise<void | boolean>;
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const CLIENT_TIMEOUT_MS = 60_000;

export function useCargaPdfIa({ categorias, onParsed }: Args) {
  const { organizationId } = useOrgActiva();
  const [pdf, setPdf] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => setPdf(null), []);

  const handlePdf = useCallback((f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
      notifyError(undefined, {
        title: "El archivo debe ser un PDF",
        method: "FEATURES_CXP_HOOKS_USECARGAPDFIA_MIME",
      });
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      notifyError(undefined, {
        title: "El PDF excede 10 MB",
        method: "FEATURES_CXP_HOOKS_USECARGAPDFIA_SIZE",
      });
      return;
    }
    setPdf(f);
  }, []);

  const procesar = useCallback(async () => {
    if (!pdf || !organizationId) return;
    setLoading(true);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("CLIENT_TIMEOUT")), CLIENT_TIMEOUT_MS);
      });
      const data = await Promise.race([parsePdfInvoice(pdf, categorias, organizationId), timeoutPromise]);
      const consumerResult = await onParsed(data, { pdf });
      if (consumerResult !== false) {
        notifySuccess(undefined, { title: "Factura procesada por IA — revisa los datos antes de guardar" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error procesando PDF";
      const isTimeout = msg === "CLIENT_TIMEOUT";
      const title = isTimeout
        ? "La IA tardó demasiado en procesar el PDF. Inténtalo de nuevo o usa Captura manual."
        : msg;
      notifyError(undefined, {
        title,
        error: e,
        context: e instanceof CfdiUploadError ? { ...e.context } as Record<string, unknown> : { pdfName: pdf.name, pdfSize: pdf.size },
        method: "FEATURES_CXP_HOOKS_USECARGAPDFIA_ERR",
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [pdf, categorias, onParsed, organizationId]);

  return { pdf, loading, setPdf, reset, handlePdf, procesar };
}
