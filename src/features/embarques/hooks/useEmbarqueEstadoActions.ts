import { useToast } from "@/hooks/shared";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import { ESTADOS_EMBARQUE } from "@/features/embarques/constants/embarqueConstants";
import {
  useAvanzarEstadoEmbarque,
  useReabrirEmbarque,
  useSyncEstadoEmbarque,
  calcularEstadoEmbarque,
  type EmbarqueRow,
} from "@/features/embarques/hooks/useEmbarques";
import { useEmbarqueConceptosVenta } from "@/features/embarques/hooks/useEmbarqueQueries";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { useEffect, useState, useCallback } from "react";

export function getSiguienteEstado(estadoActual: string) {
  const idx = (ESTADOS_EMBARQUE as readonly string[]).indexOf(estadoActual);
  if (idx < 0 || idx >= ESTADOS_EMBARQUE.length - 1) return null;
  return ESTADOS_EMBARQUE[idx + 1];
}

/**
 * Hook focalizado en la sincronización + avance de estado del embarque.
 * Separado de la gestión de documentos para mantener responsabilidades únicas.
 *
 * Incluye:
 * - Auto-sync de estado calculado (ETD/ETA → estado visible).
 * - Avance manual de estado con advertencia soft al cerrar si hay conceptos
 *   de venta sin proforma (el usuario decide si confirma o cancela).
 * - Reapertura de embarques cerrados (solo admin, validado en backend).
 */
export function useEmbarqueEstadoActions(embarque: EmbarqueRow | undefined, id: string | undefined) {
  const { toast } = useToast();
  const { user } = useAuth();
  const registrarActividad = useRegistrarActividad();
  const avanzarEstado = useAvanzarEstadoEmbarque();
  const reabrirEmbarque = useReabrirEmbarque();
  const syncEstado = useSyncEstadoEmbarque();
  const { data: conceptosVenta = [] } = useEmbarqueConceptosVenta(id);

  // Auto-sync estado calculado a BD. Sólo recalcula si cambian inputs reales.
  const embarqueId = embarque?.id;
  const modo = embarque?.modo;
  const tipo = embarque?.tipo;
  const etd = embarque?.etd;
  const eta = embarque?.eta;
  const estado = embarque?.estado;
  const { mutate: syncEstadoMutate } = syncEstado;
  useEffect(() => {
    if (!embarqueId || !modo || !estado) return;
    if (!tipo) return;
    const estadoCalculado = calcularEstadoEmbarque(modo, tipo, etd ?? null, eta ?? null, estado);
    if (estadoCalculado !== estado) {
      syncEstadoMutate({ embarqueId, nuevoEstado: estadoCalculado });
    }
  }, [embarqueId, modo, tipo, etd, eta, estado, syncEstadoMutate]);

  // Cantidad de conceptos de venta aún no incluidos en una proforma.
  // Se usa para mostrar advertencia soft al cerrar el embarque.
  const conceptosSinProforma = conceptosVenta.filter(
    (c) => c.estado_facturacion !== "en_proforma",
  ).length;

  // Estado del AlertDialog de advertencia al pasar a Cerrado sin proforma.
  const [warnCierreOpen, setWarnCierreOpen] = useState(false);

  const ejecutarAvance = useCallback(async (siguiente: string) => {
    if (!embarque || !id) return;
    try {
      await avanzarEstado.mutateAsync({
        embarqueId: id,
        nuevoEstado: siguiente,
        usuarioEmail: user?.email ?? '',
      });
      registrarActividad.mutate({
        accion: 'cambiar_estado', modulo: 'embarques',
        entidad_id: id, entidad_nombre: embarque.expediente,
        detalles: { estado_anterior: embarque.estado, estado_nuevo: siguiente },
      });
      notifySuccess(toast, { title: `Estado actualizado a "${siguiente}"` });
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al cambiar estado", description: getErrorMessage(err), error: err, method: "HANDLE_AVANZAR_ESTADO" });
    }
  }, [embarque, id, avanzarEstado, user?.email, registrarActividad, toast]);

  const handleAvanzarEstado = async () => {
    if (!embarque || !id) return;
    const siguiente = getSiguienteEstado(embarque.estado);
    if (!siguiente) return;
    // Soft warning: si cierra con conceptos pendientes de proforma, pide confirmación extra.
    if (siguiente === "Cerrado" && conceptosSinProforma > 0) {
      setWarnCierreOpen(true);
      return;
    }
    await ejecutarAvance(siguiente);
  };

  const confirmarCierreSinProforma = useCallback(async () => {
    setWarnCierreOpen(false);
    await ejecutarAvance("Cerrado");
  }, [ejecutarAvance]);

  const handleReabrir = async () => {
    if (!embarque || !id) return;
    try {
      await reabrirEmbarque.mutateAsync({
        embarqueId: id,
        usuarioEmail: user?.email ?? '',
      });
      registrarActividad.mutate({
        accion: 'reabrir_embarque', modulo: 'embarques',
        entidad_id: id, entidad_nombre: embarque.expediente,
        detalles: { estado_anterior: 'Cerrado', estado_nuevo: 'Entregado' },
      });
      notifySuccess(toast, { title: "Embarque reabierto", description: "Ahora puedes generar la proforma o ajustar facturación." });
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al reabrir embarque", description: getErrorMessage(err), error: err, method: "HANDLE_REABRIR_EMBARQUE" });
    }
  };

  return {
    handleAvanzarEstado,
    avanzarEstado,
    handleReabrir,
    reabrirEmbarque,
    warnCierreOpen,
    setWarnCierreOpen,
    confirmarCierreSinProforma,
    conceptosSinProforma,
  };
}
