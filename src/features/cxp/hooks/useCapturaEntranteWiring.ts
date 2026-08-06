/**
 * Cableado del formulario de captura cuando el origen es el buzón CxP.
 *
 * v13.366.0 — Aísla el embarque inicial heredado del documento y el cierre del
 * ciclo (`capturar_factura_entrante`) para mantener el diálogo simple.
 * v13.427.0 — Al cerrar el ciclo, los archivos del buzón se copian al bucket
 * de la factura para que la pestaña "Documentos" no quede vacía.
 */
import { useCallback } from "react";
import { useCapturarFacturaEntrante } from "./useFacturasEntrantes";
import { useAuth } from "@/lib/contexts/AuthContext";
import { copiarArchivosEntranteAFactura } from "@/features/cxp/services/copiarArchivosEntrante";
import { notifyBestEffortFallo } from "./useNuevaFacturaProveedorForm.bestEffort";
import type { EmbarqueSeleccionado, EntranteParaCaptura } from "@/features/cxp/types";

interface Args {
  entrante: EntranteParaCaptura | null | undefined;
  initialEmbarqueAdHoc?: EmbarqueSeleccionado | null;
  onCerrar: () => void;
  onCapturada?: () => void;
}

export function useCapturaEntranteWiring({
  entrante, initialEmbarqueAdHoc, onCerrar, onCapturada,
}: Args) {
  // El submit del formulario ya notifica "Factura de proveedor capturada":
  // aquí silenciamos el toast del buzón para no mostrarlo doble.
  const capturar = useCapturarFacturaEntrante({ silencioso: true });
  const { organizationId } = useAuth();


  const embarqueInicial: EmbarqueSeleccionado | null =
    initialEmbarqueAdHoc ??
    (entrante
      ? {
          embarqueId: entrante.embarqueId,
          expediente: entrante.expediente ?? "",
          concepto: "Factura de proveedor",
        }
      : null);

  const onDone = useCallback(
    async (facturaId?: string | null) => {
      if (entrante && facturaId) {
        await capturar.mutateAsync({ id: entrante.id, facturaId });
        // Best-effort: la factura ya quedó capturada; si la copia de adjuntos
        // falla se avisa y el usuario puede adjuntarlos a mano.
        try {
          await copiarArchivosEntranteAFactura({
            facturaId,
            organizationId,
            archivoPath: entrante.archivoPath,
            nombreArchivo: entrante.nombreArchivo,
            xmlPath: entrante.xmlPath,
            xmlNombre: entrante.xmlNombre,
          });
        } catch (e) {
          notifyBestEffortFallo(
            "Factura capturada, pero los adjuntos del buzón no se copiaron",
            e,
          );
        }
        onCapturada?.();
      }
      onCerrar();
    },
    [entrante, capturar, onCapturada, onCerrar, organizationId],
  );

  return { embarqueInicial, onDone };
}
