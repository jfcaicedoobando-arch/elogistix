import { useToast } from "@/hooks/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import {
  useAvanzarEstadoEmbarque,
  useReabrirEmbarque,
  useSyncEstadoEmbarque,
  calcularEstadoEmbarque,
  type EmbarqueRow,
} from "@/features/embarques/hooks/useEmbarques";
import { useEmbarqueConceptosVenta } from "@/features/embarques/hooks/useEmbarqueQueries";
import { useDocsFaltantesParaEstado } from "@/features/embarques/hooks/useDocsFaltantesParaEstado";
import { useValidacionCierre } from "@/features/embarques/hooks/useCierreEmbarque";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { useEffect, useState, useCallback } from "react";
import {
  getSiguienteEstado,
  resolveCierreGate,
  clasificarBloqueoAvance,
  clasificarAvanceError,
} from "./useEmbarqueEstadoActions.helpers";

export { getSiguienteEstado } from "./useEmbarqueEstadoActions.helpers";

interface AutoSyncArgs {
  embarqueId: string;
  modo: string;
  tipo: string;
  estado: string;
  etd: string | null;
  eta: string | null;
  fechaLlegadaReal: string | null;
  usuarioEmail: string;
  sync: (args: { embarqueId: string; nuevoEstado: string; usuarioEmail: string }) => void;
}

/** Efecto puro: recalcula y sincroniza si cambió. Aislado para bajar complejidad. */
function runAutoSyncEstado(args: AutoSyncArgs) {
  const { embarqueId, modo, tipo, estado, etd, eta, fechaLlegadaReal, usuarioEmail, sync } = args;
  const estadoCalculado = calcularEstadoEmbarque(modo, tipo, etd, eta, estado, fechaLlegadaReal);
  if (estadoCalculado !== estado) {
    sync({ embarqueId, nuevoEstado: estadoCalculado, usuarioEmail });
  }
}

/**
 * Auto-sync del estado calculado a BD. Se aísla en su propio hook para
 * mantener la complejidad ciclomática del hook principal bajo control.
 */
function useAutoSyncEstadoEmbarque(
  embarque: EmbarqueRow | undefined,
  puedeSincronizarEstado: boolean,
  usuarioEmail: string,
) {
  const { mutate: syncEstadoMutate } = useSyncEstadoEmbarque();
  const embarqueId = embarque?.id;
  const modo = embarque?.modo;
  const tipo = embarque?.tipo;
  const etd = embarque?.etd ?? null;
  const eta = embarque?.eta ?? null;
  const estado = embarque?.estado;
  const fechaLlegadaReal = embarque?.fecha_llegada_real ?? null;
  useEffect(() => {
    if (!puedeSincronizarEstado) return;
    if (!embarqueId || !modo || !tipo || !estado) return;
    runAutoSyncEstado({
      embarqueId, modo, tipo, estado, etd, eta, fechaLlegadaReal, usuarioEmail,
      sync: syncEstadoMutate,
    });
  }, [puedeSincronizarEstado, embarqueId, modo, tipo, etd, eta, estado, fechaLlegadaReal, syncEstadoMutate, usuarioEmail]);
}


/**
 * Consolida las variables derivadas del "gate de cierre" en un solo objeto.
 * Extraído de `useEmbarqueEstadoActions` para reducir su complejidad ciclomática.
 */
function useCierreGate(
  siguienteEstado: string | null,
  id: string | undefined,
) {
  const { canEditFinance, isAdmin } = usePermissions();
  const cierreEsSiguiente = siguienteEstado === "Cerrado";
  const idCierre = cierreEsSiguiente ? id : undefined;
  const { data: validacionCierre } = useValidacionCierre(idCierre);
  const rolPuedeCerrar = isAdmin || canEditFinance;
  // v13.135.59 — Admins pueden forzar el cierre aunque el checklist esté incompleto.
  const validacionOk = validacionCierre?.puede_cerrar === true || isAdmin;
  const motivo = resolveCierreGate(cierreEsSiguiente, rolPuedeCerrar, validacionOk);
  return {
    cierreEsSiguiente,
    rolPuedeCerrar,
    motivo,
    cierrePuedeAvanzar: cierreEsSiguiente && motivo === null,
  };
}

/**
 * Hook focalizado en la sincronización + avance de estado del embarque.
 * Candado de documentos al avanzar (bloqueante en estados avanzados, suave en
 * Confirmado/En Tránsito). Cierre: validación dura por rol + checklist.
 */
export function useEmbarqueEstadoActions(embarque: EmbarqueRow | undefined, id: string | undefined) {
  const { toast } = useToast();
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
      notifyError(toast, {
        title: "Transición de estado no permitida",
        description: `No se permite pasar de "${estadoActual}" a "${siguiente}". Refresca la página; el estado del embarque pudo cambiar en otra sesión.`,
        error: err, method: "HANDLE_AVANZAR_ESTADO_TRANSICION",
      });
      return;
    }
    notifyError(toast, { title: "Error al cambiar estado", description: msg, error: err, method: "HANDLE_AVANZAR_ESTADO" });
  }, [toast]);

  const ejecutarAvance = useCallback(async (siguiente: string) => {
    if (!embarque || !id) return;
    try {
      await avanzarEstado.mutateAsync({ embarqueId: id, nuevoEstado: siguiente, usuarioEmail });
      registrarActividad.mutate({
        accion: 'cambiar_estado', modulo: 'embarques',
        entidad_id: id, entidad_nombre: labelExpediente(embarque.expediente, embarque.id),
        detalles: { estado_anterior: embarque.estado, estado_nuevo: siguiente },
      });
      notifySuccess(toast, { title: `Estado actualizado a "${siguiente}"` });
    } catch (err: unknown) {
      notificarErrorAvance(err, embarque.estado, siguiente);
    }
  }, [embarque, id, avanzarEstado, usuarioEmail, registrarActividad, toast, notificarErrorAvance]);

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
      notifyError(toast, {
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
      notifySuccess(toast, { title: "Embarque reabierto", description: "Ahora puedes generar la proforma o ajustar facturación." });
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al reabrir embarque", description: getErrorMessage(err), error: err, method: "HANDLE_REABRIR_EMBARQUE" });
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
