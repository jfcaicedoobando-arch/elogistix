/**
 * useDescargarCfdi — encapsula la lógica de descarga de PDF/XML para
 * una factura (proxy FacturApi vs URL almacenada). Reduce complejidad
 * de FacturaDetalle.
 */
import { useCallback } from "react";
import { openFacturaInNewTab } from "@/services/storage";
import { descargarCfdiFacturapi, esUrlFacturapi } from "@/features/facturacion/services/descargarCfdiFacturapi";
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors/index";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";

export function useDescargarCfdi(facturaId: string | undefined) {
  return useCallback(
    async (stored: string | null, tipo: "pdf" | "xml") => {
      try {
        const usarProxy = !stored || esUrlFacturapi(stored);
        if (usarProxy && facturaId) {
          await descargarCfdiFacturapi({ tipo, facturaId });
        } else if (stored) {
          await openFacturaInNewTab(stored);
        }
      } catch (err) {
        reportCaughtError(err, { feature: "facturacion", op: "descargar_cfdi", tipo }, { facturaId });
        notifyError(undefined, {
          title: `No se pudo abrir el ${tipo.toUpperCase()}`,
          description: getErrorMessage(err),
          error: err,
          method: "FACTURACION_DESCARGAR_CFDI",
          context: { facturaId, tipo },
        });
      }
    },
    [facturaId],
  );
}
