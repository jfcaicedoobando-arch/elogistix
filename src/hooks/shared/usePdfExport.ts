/**
 * Q-16 — Estado de carga + feedback consistente para exportadores de PDF.
 * Deshabilita el disparador mientras genera, y emite toast de éxito/error.
 */
import { useCallback, useState } from "react";
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

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (isExporting) return;
      setIsExporting(true);
      try {
        await fn();
        if (successTitle) notifySuccess(undefined, { title: successTitle });
      } catch (error) {
        notifyError(undefined, { title: errorTitle, error, method });
      } finally {
        setIsExporting(false);
      }
    },
    [isExporting, successTitle, errorTitle, method],
  );

  return { isExporting, run };
}
