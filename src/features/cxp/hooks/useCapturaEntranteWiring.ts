/**
 * Cableado del formulario de captura cuando el origen es el buzón CxP.
 *
 * v13.366.0 — Aísla el embarque inicial heredado del documento y el cierre del
 * ciclo (`capturar_factura_entrante`) para mantener el diálogo simple.
 * v13.427.0 — Al cerrar el ciclo, los archivos del buzón se copian al bucket
 * de la factura para que la pestaña "Documentos" no quede vacía.
 * v13.850.0 — P1: si "marcar como capturado" falla DESPUÉS de crear la
 * factura, ya no se cierra el diálogo ni se pierde el id creado. Se conserva
 * `facturaIdPendiente` para reintentar sólo el paso pendiente (UPDATE sobre
 * el documento del buzón) sin volver a insertar la factura.
 */
import { useCallback, useState } from "react";
import { useCapturarFacturaEntrante } from "./useFacturasEntrantes";
import { copiarArchivosEntranteAFactura } from "@/features/cxp/services/copiarArchivosEntrante";
import { notifyBestEffortFallo } from "./useNuevaFacturaProveedorForm.bestEffort";
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import type { EmbarqueSeleccionado, EntranteParaCaptura } from "@/features/cxp/types";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

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
  const { organizationId } = useOrgActiva();
  // Factura ya creada cuyo paso "marcar capturado" quedó pendiente por un
  // fallo: se conserva para permitir reintento idempotente (nunca se vuelve
  // a crear la factura, sólo se reintenta el UPDATE del documento).
  const [facturaIdPendiente, setFacturaIdPendiente] = useState<string | null>(null);

  const embarqueInicial: EmbarqueSeleccionado | null =
    initialEmbarqueAdHoc ??
    (entrante
      ? {
          embarqueId: entrante.embarqueId,
          expediente: entrante.expediente ?? "",
          concepto: "Factura de proveedor",
        }
      : null);

  /** Marca el documento como capturado y copia sus adjuntos a la factura. */
  const cerrarCiclo = useCallback(
    async (facturaId: string) => {
      if (!entrante) return;
      // Paso crítico: si falla, el documento del buzón sigue "por capturar"
      // y hay que reintentarlo (idempotente: UPDATE por id, no crea nada).
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
    },
    [entrante, capturar, onCapturada, organizationId],
  );

  /**
   * Ejecuta el cierre del ciclo. Si falla, conserva `facturaIdPendiente` y
   * NO cierra el diálogo: el usuario reintenta con el mismo id (idempotente).
   */
  const ejecutarCierre = useCallback(
    async (facturaId: string): Promise<boolean> => {
      try {
        await cerrarCiclo(facturaId);
        setFacturaIdPendiente(null);
        onCerrar();
        return true;
      } catch (e) {
        setFacturaIdPendiente(facturaId);
        notifyError(undefined, {
          title: "La factura se creó, pero no se marcó como capturada en el buzón",
          description: `${getErrorMessage(e)} La factura NO se duplicará: al reintentar se reutiliza la ya creada.`,
          method: "CXP_CAPTURA_ENTRANTE_MARCAR",
          action: { label: "Reintentar", onClick: () => { void ejecutarCierre(facturaId); } },
        });
        return false;
      }
    },
    [cerrarCiclo, onCerrar],
  );

  /** Botón "Guardar" del diálogo cuando hay una factura pendiente de cerrar. */
  const reintentar = useCallback(() => {
    if (facturaIdPendiente) void ejecutarCierre(facturaIdPendiente);
  }, [facturaIdPendiente, ejecutarCierre]);

  /** `onDone` del formulario: `true` si el ciclo cerró (dialogo puede resetear). */
  const onDone = useCallback(
    async (facturaId?: string | null): Promise<boolean> => {
      if (entrante && facturaId) return ejecutarCierre(facturaId);
      onCerrar();
      return true;
    },
    [entrante, ejecutarCierre, onCerrar],
  );

  return { embarqueInicial, onDone, facturaIdPendiente, reintentar };
}
