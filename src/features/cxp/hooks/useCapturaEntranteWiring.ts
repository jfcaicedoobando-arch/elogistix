/**
 * Cableado del formulario de captura cuando el origen es el buzón CxP.
 *
 * v13.366.0 — Aísla el embarque inicial heredado del documento y el cierre del
 * ciclo (`capturar_factura_entrante`) para mantener el diálogo simple.
 */
import { useCallback } from "react";
import { useCapturarFacturaEntrante } from "./useFacturasEntrantes";
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
        onCapturada?.();
      }
      onCerrar();
    },
    [entrante, capturar, onCapturada, onCerrar],
  );

  return { embarqueInicial, onDone };
}
