/**
 * useDescargarCfdi — encapsula la lógica de descarga de PDF/XML para
 * una factura (proxy FacturApi vs URL almacenada). Reduce complejidad
 * de FacturaDetalle.
 */
import { useCallback } from "react";
import { openFacturaInNewTab } from "@/services/storage";
import { descargarCfdiFacturapi, esUrlFacturapi } from "@/features/facturacion/services/descargarCfdiFacturapi";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { getErrorMessage } from "@/lib/errors/index";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { useToast } from "@/hooks/shared";

export function useDescargarCfdi(facturaId: string | undefined) {
  const { toast } = useToast();
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
        notifyError(toast, {
          title: `No se pudo abrir el ${tipo.toUpperCase()}`,
          description: getErrorMessage(err),
          method: "ON_ERROR",
          errorCode: ERROR_CODES.VALIDATION_FAILED,
        });
      }
    },
    [facturaId, toast],
  );
}
