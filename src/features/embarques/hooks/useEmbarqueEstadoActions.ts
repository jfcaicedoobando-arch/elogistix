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
import { labelExpediente } from "@/features/embarques/domain/labelExpediente";
import { useEffect, useState, useCallback } from "react";
import {
  getSiguienteEstado,
  resolveCierreGate,
  clasificarBloqueoAvance,
} from "./useEmbarqueEstadoActions.helpers";

export { getSiguienteEstado } from "./useEmbarqueEstadoActions.helpers";

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
    if (!embarqueId || !modo || !tipo || !estado || !puedeSincronizarEstado) return;
    const estadoCalculado = calcularEstadoEmbarque(modo, tipo, etd, eta, estado, fechaLlegadaReal);
    if (estadoCalculado !== estado) {
      syncEstadoMutate({ embarqueId, nuevoEstado: estadoCalculado, usuarioEmail });
    }
  }, [embarqueId, modo, tipo, etd, eta, estado, fechaLlegadaReal, syncEstadoMutate, usuarioEmail, puedeSincronizarEstado]);
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
  const { canEditFinance, isAdmin, canEditOperations, isSuperAdmin } = usePermissions();
  // v13.209.3 — Auto-sync sólo si el usuario puede escribir en embarques/eventos_embarque.
  const puedeSincronizarEstado = isAdmin || isSuperAdmin || canEditOperations;

  const siguienteEstado = embarque ? getSiguienteEstado(embarque.estado) : null;
  const { faltantes: docsFaltantes, bloqueante: docsBloqueantes } =
    useDocsFaltantesParaEstado(id, siguienteEstado);

  // v13.89.1 — Validación dura para cierre: solo admin/finanzas pueden cerrar,
  // y solo si todas las reglas del checklist (CxC, CxP, docs, etc.) pasan.
  const cierreVisible = siguienteEstado === "Cerrado";
  const idCierre = cierreVisible ? id : undefined;
  const { data: validacionCierre } = useValidacionCierre(idCierre);
  const rolPuedeCerrar = isAdmin || canEditFinance;
  // v13.135.59 — Admins pueden forzar el cierre aunque el checklist esté incompleto.
  const validacionOk = validacionCierre?.puede_cerrar === true || isAdmin;
  const bloqueoCierreMotivo = resolveCierreGate(cierreVisible, rolPuedeCerrar, validacionOk);

  const usuarioEmail = user?.email ?? "";
  useAutoSyncEstadoEmbarque(embarque, puedeSincronizarEstado, usuarioEmail);

  const conceptosSinProforma = conceptosVenta.filter(
    (c) => c.estado_facturacion !== "en_proforma",
  ).length;

  const [warnCierreOpen, setWarnCierreOpen] = useState(false);
  const [warnDocsOpen, setWarnDocsOpen] = useState(false);
  const [blockDocsOpen, setBlockDocsOpen] = useState(false);
  const [blockFechaLlegadaOpen, setBlockFechaLlegadaOpen] = useState(false);

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
      const msg = getErrorMessage(err);
      if (msg.includes("documentos_faltantes")) { setBlockDocsOpen(true); return; }
      if (msg.includes("fecha_llegada_real_requerida")) { setBlockFechaLlegadaOpen(true); return; }
      if (msg.includes("LC_TRANSICION_INVALIDA")) {
        notifyError(toast, {
          title: "Transición de estado no permitida",
          description: `No se permite pasar de "${embarque.estado}" a "${siguiente}". Refresca la página; el estado del embarque pudo cambiar en otra sesión.`,
          error: err, method: "HANDLE_AVANZAR_ESTADO_TRANSICION",
        });
        return;
      }
      notifyError(toast, { title: "Error al cambiar estado", description: msg, error: err, method: "HANDLE_AVANZAR_ESTADO" });
    }
  }, [embarque, id, avanzarEstado, usuarioEmail, registrarActividad, toast]);

  const handleAvanzarEstado = async () => {
    if (!embarque || !id) return;
    const siguiente = getSiguienteEstado(embarque.estado);
    if (!siguiente) return;
    const bloqueo = clasificarBloqueoAvance({
      docsBloqueantes, docsFaltantesCount: docsFaltantes.length, siguiente, bloqueoCierreMotivo,
      fechaLlegadaReal: embarque.fecha_llegada_real ?? null,
    });
    switch (bloqueo) {
      case "block_docs": setBlockDocsOpen(true); return;
      case "block_fecha_llegada": setBlockFechaLlegadaOpen(true); return;
      case "warn_docs": setWarnDocsOpen(true); return;
      case "gate_cierre":
        notifyError(toast, {
          title: bloqueoCierreMotivo === "rol"
            ? "Solo administración/finanzas pueden cerrar el embarque"
            : "Pendientes administrativos. Revisa el Tab Cierre.",
          method: "GATE_CERRAR_EMBARQUE",
        });
        return;
      case "ok": await ejecutarAvance(siguiente);
    }
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
    cierreEsSiguiente: cierreVisible, rolPuedeCerrar,
    cierrePuedeAvanzar: cierreVisible && bloqueoCierreMotivo === null,
    cierreMotivoBloqueo: bloqueoCierreMotivo,
  };

}

