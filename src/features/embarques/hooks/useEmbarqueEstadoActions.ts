import { useAuth } from "@/lib/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import {
  useAvanzarEstadoEmbarque,
  useReabrirEmbarque,
  type EmbarqueRow,
} from "@/features/embarques/hooks/useEmbarques";
import { useEmbarqueConceptosVenta } from "@/features/embarques/hooks/useEmbarqueQueries";
import { useDocsFaltantesParaEstado } from "@/features/embarques/hooks/useDocsFaltantesParaEstado";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { useState, useCallback } from "react";
import {
  getSiguienteEstado,
  clasificarBloqueoAvance,
  clasificarAvanceError,
} from "./useEmbarqueEstadoActions.helpers";
import {
  useAutoSyncEstadoEmbarque,
  useCierreGate,
} from "./useEmbarqueEstadoActions.internals";

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
  const reabrirEmbarque = useReabrirEmbarque();
  const conceptosQuery = useEmbarqueConceptosVenta(id);
  const conceptosVenta = conceptosQuery.data ?? [];
  const { isAdmin, canEditOperations, isSuperAdmin } = usePermissions();
  // v13.209.3 — Auto-sync sólo si el usuario puede escribir en embarques/eventos_embarque.
  const puedeSincronizarEstado = isAdmin || isSuperAdmin || canEditOperations;

  const siguienteEstado = embarque ? getSiguienteEstado(embarque.estado) : null;
  const { faltantes: docsFaltantes, bloqueante: docsBloqueantes } =
    useDocsFaltantesParaEstado(id, siguienteEstado);

  // v13.89.1 — Validación dura para cierre: solo admin/finanzas pueden cerrar,
  // y solo si todas las reglas del checklist (CxC, CxP, docs, etc.) pasan.
  const cierre = useCierreGate(siguienteEstado, id);

  const usuarioEmail = user?.email ?? "";
  useAutoSyncEstadoEmbarque(embarque, puedeSincronizarEstado, usuarioEmail);


  const conceptosSinProforma = conceptosVenta.filter(
    (c) => c.estado_facturacion !== "en_proforma",
  ).length;

  const [warnCierreOpen, setWarnCierreOpen] = useState(false);
  const [warnDocsOpen, setWarnDocsOpen] = useState(false);
  const [blockDocsOpen, setBlockDocsOpen] = useState(false);
  const [blockFechaLlegadaOpen, setBlockFechaLlegadaOpen] = useState(false);

  const notificarErrorAvance = useCallback((
    err: unknown,
    estadoActual: string,
    siguiente: string,
  ) => {
    const msg = getErrorMessage(err);
    const kind = clasificarAvanceError(msg);
    if (kind === "block_docs") { setBlockDocsOpen(true); return; }
    if (kind === "block_fecha_llegada") { setBlockFechaLlegadaOpen(true); return; }
    if (kind === "transicion_invalida") {
      notifyError(undefined, {
        title: "Transición de estado no permitida",
        description: `No se permite pasar de "${estadoActual}" a "${siguiente}". Refresca la página; el estado del embarque pudo cambiar en otra sesión.`,
        error: err, method: "HANDLE_AVANZAR_ESTADO_TRANSICION",
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

  const handleReabrir = async () => {
    if (!embarque || !id) return;
    try {
      await reabrirEmbarque.mutateAsync({ embarqueId: id, usuarioEmail });
      registrarActividad.mutate({
        accion: 'reabrir_embarque', modulo: 'embarques',
        entidad_id: id, entidad_nombre: labelExpediente(embarque.expediente, embarque.id),
        detalles: { estado_anterior: 'Cerrado', estado_nuevo: 'Entregado' },
      });
      notifySuccess(undefined, { title: "Embarque reabierto", description: "Ahora puedes generar la proforma o ajustar facturación." });
    } catch (err: unknown) {
      notifyError(undefined, { title: "Error al reabrir embarque", description: getErrorMessage(err), error: err, method: "HANDLE_REABRIR_EMBARQUE" });
    }
  };

  return {
    handleAvanzarEstado, avanzarEstado, handleReabrir, reabrirEmbarque,
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
