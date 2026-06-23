/**
 * Hook que encapsula el estado y la lógica de subida del XML CFDI para
 * `CargaCfdiSection`. Separa el "qué hace" (red, validación, toasts) del
 * "cómo se ve" (componente), y mantiene ambos archivos < 200 líneas
 * (regla Power of 10).
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { parseCfdiXml, type CfdiParsedResponse } from "@/features/cxp/services";
import { CfdiUploadError } from "@/features/cxp/services/parseCfdi";
import { notifyError } from "@/components/shared/utils/appFeedback";

interface UseCargaCfdiArgs {
  categorias: { id: string; nombre: string }[];
  onParsed: (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => void;
}

const MAX_XML_BYTES = 2 * 1024 * 1024;
const CLIENT_TIMEOUT_MS = 15_000;

export function useCargaCfdi({ categorias, onParsed }: UseCargaCfdiArgs) {
  const [xml, setXml] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setXml(null);
    setPdf(null);
  }, []);

  const handleXml = useCallback((f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xml")) {
      notifyError(toast, {
        title: "El archivo debe ser .xml",
        method: "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_1",
      });
      return;
    }
    if (f.size > MAX_XML_BYTES) {
      notifyError(toast, {
        title: "XML excede 2 MB",
        method: "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_2",
      });
      return;
    }
    setXml(f);
  }, []);

  const procesar = useCallback(async () => {
    if (!xml) return;
    setLoading(true);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("CLIENT_TIMEOUT")), CLIENT_TIMEOUT_MS);
      });
      const data = await Promise.race([parseCfdiXml(xml, categorias), timeoutPromise]);
      onParsed(data, { xml, pdf });
      toast.success("CFDI procesado");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error procesando XML";
      const baseCtx = {
        xmlName: xml.name,
        xmlSize: xml.size,
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
      };
      const richCtx = e instanceof CfdiUploadError ? { ...baseCtx, ...e.context } : baseCtx;
      const isTimeout = msg === "CLIENT_TIMEOUT";
      notifyError(toast, {
        title: isTimeout
          ? "Tiempo de espera agotado al procesar el XML. Inténtalo de nuevo o usa Captura manual."
          : msg,
        error: e,
        context: richCtx,
        method: isTimeout
          ? "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_3"
          : "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_4",
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [xml, pdf, categorias, onParsed]);

  return { xml, pdf, loading, setPdf, reset, handleXml, procesar };
}
