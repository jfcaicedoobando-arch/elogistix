/**
 * Q-16 — Estado de carga + feedback consistente para exportadores de PDF.
 * Deshabilita el disparador mientras genera, y emite toast de éxito/error.
 */
import { useCallback, useRef, useState } from "react";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

interface Options {
  /** Título del toast de éxito. Si se omite, no se muestra toast de éxito. */
  successTitle?: string;
  /** Título del toast de error. */
  errorTitle?: string;
  method?: string;
}

export function usePdfExport(options: Options = {}) {
  const { successTitle, errorTitle = "No se pudo generar el PDF", method } = options;
  const [isExporting, setIsExporting] = useState(false);
  // Ola 9 · M14: el candado vive en un ref para bloquear el doble clic dentro
  // del mismo frame (el estado aún no se refleja en la closure).
  const lockRef = useRef(false);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setIsExporting(true);
      try {
        await fn();
        if (successTitle) notifySuccess(undefined, { title: successTitle });
      } catch (error) {
        notifyError(undefined, { title: errorTitle, error, method });
      } finally {
        lockRef.current = false;
        setIsExporting(false);

      }
    },
    [successTitle, errorTitle, method],
  );

  return { isExporting, run };
}
