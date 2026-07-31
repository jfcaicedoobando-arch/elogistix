import { useAuth } from "@/lib/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import {
  useAvanzarEstadoEmbarque,
  type EmbarqueRow,
} from "@/features/embarques/hooks/useEmbarques";
import { useEmbarqueConceptosVenta } from "@/features/embarques/hooks/useEmbarqueQueries";
import { useDocsFaltantesParaEstado } from "@/features/embarques/hooks/useDocsFaltantesParaEstado";
import { useContenedoresEmbarque } from "@/features/embarques/hooks/useContenedoresEmbarque";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { useState, useCallback } from "react";
import {
  getSiguienteEstado,
  clasificarBloqueoAvance,
  clasificarAvanceError,
  faltantesParaConfirmado,
} from "./useEmbarqueEstadoActions.helpers";
import {
  useAutoSyncEstadoEmbarque,
  useCierreGate,
} from "./useEmbarqueEstadoActions.internals";
import { useValidacionCierre } from "./useCierreEmbarque";
import { useEmbarqueReabrirCancelar } from "./useEmbarqueReabrirCancelar";

export { getSiguienteEstado } from "./useEmbarqueEstadoActions.helpers";

/**
 * Hook focalizado en la sincronización + avance de estado del embarque.
 * Candado de documentos al avanzar (bloqueante en estados avanzados, suave en
 * Confirmado/En Tránsito). Cierre: validación dura por rol + checklist.
 */
export function useEmbarqueEstadoActions(embarque: EmbarqueRow | undefined, id: string | undefined) {
  const { user } = useAuth();
  const registrarActividad = useRegistrarActividad();
  const avanzarEstado = useAvanzarEstadoEmbarque();
  const conceptosQuery = useEmbarqueConceptosVenta(id);
  const conceptosVenta = conceptosQuery.data ?? [];
  const { data: contenedores = [] } = useContenedoresEmbarque(id);
  const { isAdmin, canEditOperations, isSuperAdmin } = usePermissions();
  const puedeSincronizarEstado = isAdmin || isSuperAdmin || canEditOperations;

  const siguienteEstado = embarque ? getSiguienteEstado(embarque.estado) : null;
  const { faltantes: docsFaltantes, bloqueante: docsBloqueantes } =
    useDocsFaltantesParaEstado(id, siguienteEstado);

  const cierre = useCierreGate(siguienteEstado, id);
  const { data: cierreCheck } = useValidacionCierre(id);
  const tieneDeudaPendiente = (cierreCheck?.checks ?? []).some(
    (c) => (c.regla === "cxc_sin_pendientes" || c.regla === "cxp_sin_pendientes") && !c.ok,
  );

  const usuarioEmail = user?.email ?? "";
  useAutoSyncEstadoEmbarque(embarque, puedeSincronizarEstado, usuarioEmail);

  const { handleReabrir, reabrirEmbarque, handleCancelar } =
    useEmbarqueReabrirCancelar(embarque, id, usuarioEmail);

  const conceptosSinProforma = conceptosVenta.filter(
    (c) => c.estado_facturacion !== "en_proforma",
  ).length;

  const [warnCierreOpen, setWarnCierreOpen] = useState(false);
  const [warnDocsOpen, setWarnDocsOpen] = useState(false);
  const [blockDocsOpen, setBlockDocsOpen] = useState(false);
  const [blockFechaLlegadaOpen, setBlockFechaLlegadaOpen] = useState(false);

  const notificarErrorAvance = useCallback((err: unknown, estadoActual: string, siguiente: string) => {
    const msg = getErrorMessage(err);
    const kind = clasificarAvanceError(msg);
    if (kind === "block_docs") { setBlockDocsOpen(true); return; }
    if (kind === "block_fecha_llegada") { setBlockFechaLlegadaOpen(true); return; }
    if (kind === "transicion_invalida") {
      notifyError(undefined, {
        title: "Transición de estado no permitida",
        description: `No se permite pasar de "${estadoActual}" a "${siguiente}". El estado del embarque pudo cambiar en otra sesión.`,
        error: err, method: "HANDLE_AVANZAR_ESTADO_TRANSICION",
        // P2-6.6: el aviso pedía "refrescar" sin darle al usuario cómo hacerlo.
        action: { label: "Recargar datos", onClick: () => { window.location.reload(); } },
      });
      return;
    }
    notifyError(undefined, { title: "Error al cambiar estado", description: msg, error: err, method: "HANDLE_AVANZAR_ESTADO" });
  }, []);

  const ejecutarAvance = useCallback(async (siguiente: string) => {
    if (!embarque || !id) return;
    try {
      await avanzarEstado.mutateAsync({ embarqueId: id, nuevoEstado: siguiente, usuarioEmail });
      registrarActividad.mutate({
        accion: 'cambiar_estado', modulo: 'embarques',
        entidad_id: id, entidad_nombre: labelExpediente(embarque.expediente, embarque.id),
        detalles: { estado_anterior: embarque.estado, estado_nuevo: siguiente },
      });
      notifySuccess(undefined, { title: `Estado actualizado a "${siguiente}"` });
    } catch (err: unknown) {
      notificarErrorAvance(err, embarque.estado, siguiente);
    }
  }, [embarque, id, avanzarEstado, usuarioEmail, registrarActividad, notificarErrorAvance]);

  const handleAvanzarEstado = async () => {
    if (!embarque || !id) return;
    const siguiente = getSiguienteEstado(embarque.estado);
    if (!siguiente) return;
    if (siguiente === "Confirmado") {
      const faltantes = faltantesParaConfirmado(embarque, contenedores.length);
      if (faltantes.length > 0) {
        notifyError(undefined, {
          title: "Faltan datos para confirmar el embarque",
          description: `Completa antes de pasar a Confirmado: ${faltantes.join(", ")}.`,
          method: "HANDLE_AVANZAR_ESTADO_MINIMOS",
        });
        return;
      }
    }
    const bloqueo = clasificarBloqueoAvance({
      docsBloqueantes, docsFaltantesCount: docsFaltantes.length, siguiente,
      bloqueoCierreMotivo: cierre.motivo,
      fechaLlegadaReal: embarque.fecha_llegada_real ?? null,
    });
    if (bloqueo === "block_docs") { setBlockDocsOpen(true); return; }
    if (bloqueo === "block_fecha_llegada") { setBlockFechaLlegadaOpen(true); return; }
    if (bloqueo === "warn_docs") { setWarnDocsOpen(true); return; }
    if (bloqueo === "gate_cierre") {
      notifyError(undefined, {
        title: cierre.motivo === "rol"
          ? "Solo administración/finanzas pueden cerrar el embarque"
          : "Pendientes administrativos. Revisa el Tab Cierre.",
        method: "GATE_CERRAR_EMBARQUE",
      });
      return;
    }
    await ejecutarAvance(siguiente);
  };

  const confirmarCierreSinProforma = useCallback(async () => {
    setWarnCierreOpen(false);
    await ejecutarAvance("Cerrado");
  }, [ejecutarAvance]);

  const confirmarAvanceConDocsPendientes = useCallback(async () => {
    setWarnDocsOpen(false);
    if (!embarque) return;
    const siguiente = getSiguienteEstado(embarque.estado);
    if (!siguiente) return;
    await ejecutarAvance(siguiente);
  }, [embarque, ejecutarAvance]);

  return {
    handleAvanzarEstado, avanzarEstado, handleReabrir, reabrirEmbarque,
    handleCancelar,
    tieneDeudaPendiente,
    warnCierreOpen, setWarnCierreOpen, confirmarCierreSinProforma, conceptosSinProforma,
    docsFaltantes, docsBloqueantes,
    warnDocsOpen, setWarnDocsOpen, blockDocsOpen, setBlockDocsOpen,
    blockFechaLlegadaOpen, setBlockFechaLlegadaOpen,
    confirmarAvanceConDocsPendientes, siguienteEstado,
    cierreEsSiguiente: cierre.cierreEsSiguiente,
    rolPuedeCerrar: cierre.rolPuedeCerrar,
    cierrePuedeAvanzar: cierre.cierrePuedeAvanzar,
    cierreMotivoBloqueo: cierre.motivo,
  };
}

