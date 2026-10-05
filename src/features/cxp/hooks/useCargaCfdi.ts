/**
 * Hook que encapsula el estado y la lógica de subida del XML CFDI para
 * `CargaCfdiSection`. Separa el "qué hace" (red, validación, toasts) del
 * "cómo se ve" (componente), y mantiene ambos archivos < 200 líneas
 * (regla Power of 10).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { parseCfdiXml, type CfdiParsedResponse } from "@/features/cxp/services";
import { CfdiUploadError } from "@/features/cxp/services/parseCfdi";
import { notifyError } from "@/lib/ui/appFeedback";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

interface UseCargaCfdiArgs {
  categorias: { id: string; nombre: string }[];
  facturaNcId?: string;
  onClear?: () => void;
  onParsed: (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => void | boolean | Promise<void | boolean>;
}

const MAX_XML_BYTES = 2 * 1024 * 1024;
const CLIENT_TIMEOUT_MS = 15_000;

function reportarErrorCarga(e: unknown, xml: File) {
      const msg = e instanceof Error ? e.message : "Error procesando XML";
      const baseCtx = {
        xmlName: xml.name,
        xmlSize: xml.size,
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
      };
      const richCtx = e instanceof CfdiUploadError ? { ...baseCtx, ...e.context } : baseCtx;
      const isTimeout = msg === "CLIENT_TIMEOUT";

      // 13.114.11: mensaje del toast por fase para que el usuario sepa
      // si revisar su red, una extensión del navegador, o esperar al
      // servidor.
      let title: string;
      if (isTimeout) {
        title = "Tiempo de espera agotado al procesar el XML. Inténtalo de nuevo o usa Captura manual.";
      } else if (e instanceof CfdiUploadError) {
        const phaseHint: Record<typeof e.context.phase, string> = {
          preflight: "El navegador bloqueó la conexión (revisa extensiones o tu red corporativa).",
          request: e.context.online
            ? "No se pudo contactar el servidor. Reintenta en unos segundos."
            : "Sin conexión a internet. Revisa tu red y reintenta.",
          response: e.context.lastStatus === 422 ? e.message : `El servidor respondió con error (HTTP ${e.context.lastStatus ?? "?"}).`,
        };
        title = phaseHint[e.context.phase];
      } else {
        title = msg;
      }

      notifyError(undefined, {
        title,
        error: e,
        context: richCtx,
        method: isTimeout
          ? "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_3"
          : "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_4",
      });
}

export function useCargaCfdi({ categorias, onParsed, facturaNcId, onClear }: UseCargaCfdiArgs) {
  const { organizationId } = useOrgActiva();
  const [xml, setXml] = useState<File | null>(null);
  const [pdf, setPdfState] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const revision = useRef(0);
  const clearRef = useRef(onClear);
  clearRef.current = onClear;
  const invalidar = useCallback(() => {
    revision.current += 1;
    setLoading(false);
    clearRef.current?.();
  }, []);
  useEffect(() => () => { revision.current += 1; }, [organizationId, facturaNcId]);
  const reset = useCallback(() => {
    invalidar();
    setXml(null);
    setPdfState(null);
  }, [invalidar]);
  const setPdf = useCallback((file: File | null) => {
    invalidar();
    setPdfState(file);
  }, [invalidar]);

  const handleXml = useCallback((f: File | null) => {
    if (!f) { reset(); return; }
    if (!f.name.toLowerCase().endsWith(".xml")) {
      notifyError(undefined, {
        title: "El archivo debe ser .xml",
        method: "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_1",
      });
      return;
    }
    if (f.size > MAX_XML_BYTES) {
      notifyError(undefined, {
        title: "XML excede 2 MB",
        method: "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_2",
      });
      return;
    }
    invalidar();
    setXml(f);
  }, [invalidar, reset]);

  const procesar = useCallback(async () => {
    if (!xml || !organizationId) return;
    const currentRevision = ++revision.current;
    setLoading(true);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("CLIENT_TIMEOUT")), CLIENT_TIMEOUT_MS);
      });
      const parse = facturaNcId
        ? parseCfdiXml(xml, categorias, organizationId, facturaNcId)
        : parseCfdiXml(xml, categorias, organizationId);
      const data = await Promise.race([parse, timeoutPromise]);
      if (revision.current !== currentRevision) return;
      // Esperamos al consumidor: si detecta problemas (cuadre fiscal, RFC, etc.)
      // devuelve `false` y suprimimos el toast de éxito para no contradecir su
      // propio toast de error.
      const consumerResult = await onParsed(data, { xml, pdf });
      if (revision.current === currentRevision && consumerResult !== false) notifySuccess(undefined, { title: "CFDI procesado" });
    } catch (e) {
      if (revision.current !== currentRevision) return;
      reportarErrorCarga(e, xml);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (revision.current === currentRevision) setLoading(false);
    }
  }, [xml, pdf, categorias, onParsed, organizationId, facturaNcId]);

  return { xml, pdf, loading, setXml, setPdf, reset, handleXml, procesar };
}
