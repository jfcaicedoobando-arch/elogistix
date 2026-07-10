import { useCallback } from "react";
import { useCopyToClipboard } from "usehooks-ts";
import { toast } from "sonner";
import { notifyError } from "@/components/shared/utils/appFeedback";

/**
 * Hook DRY para copiar texto al portapapeles con toast de feedback.
 * Envuelve `useCopyToClipboard` de `usehooks-ts` y aplica nuestros
 * helpers estándar de notificación (`sonner` + `notifyError`).
 *
 * Uso:
 *   const copy = useCopyText();
 *   <Button onClick={() => copy(uuid, { successMessage: "UUID copiado" })} />
 */
export function useCopyText() {
  const [, copyFn] = useCopyToClipboard();

  return useCallback(
    async (
      text: string,
      opts: { successMessage?: string; errorTitle?: string; method?: string } = {},
    ) => {
      const {
        successMessage = "Copiado al portapapeles",
        errorTitle = "No se pudo copiar",
        method = "useCopyText",
      } = opts;
      const ok = await copyFn(text);
      if (ok) {
        toast.success(successMessage);
      } else {
        notifyError(undefined, { title: errorTitle, method });
      }
      return ok;
    },
    [copyFn],
  );
}
