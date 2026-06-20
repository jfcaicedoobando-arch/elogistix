import { useToast } from "@/hooks/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
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
import { useDocsFaltantesParaEstado } from "@/features/embarques/hooks/useDocsFaltantesParaEstado";
import { useValidacionCierre } from "@/features/embarques/hooks/useCierreEmbarque";
import { usePermissions } from "@/hooks/shared/usePermissions";
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
 * Candado de documentos al avanzar:
 *  - Estados bloqueantes (En Aduana, Llegada, Arribo, Entregado, EIR, Cerrado):
 *    si faltan documentos, abre BlockDocsDialog y NO avanza (el backend también rechaza).
 *  - Estados soft (Confirmado, En Tránsito): si faltan documentos, abre WarnDocsDialog
 *    y deja al usuario confirmar el avance.
 *  - Cierre con conceptos sin proforma: confirmación suave existente.
 */
export function useEmbarqueEstadoActions(embarque: EmbarqueRow | undefined, id: string | undefined) {
  const { toast } = useToast();
  const { user } = useAuth();
  const registrarActividad = useRegistrarActividad();
  const avanzarEstado = useAvanzarEstadoEmbarque();
  const reabrirEmbarque = useReabrirEmbarque();
  const syncEstado = useSyncEstadoEmbarque();
  const { data: conceptosVenta = [] } = useEmbarqueConceptosVenta(id);
  const { canEditFinance, isAdmin } = usePermissions();

  const siguienteEstado = embarque ? getSiguienteEstado(embarque.estado) : null;
  const { faltantes: docsFaltantes, bloqueante: docsBloqueantes } =
    useDocsFaltantesParaEstado(id, siguienteEstado);

  // v13.89.1 — Validación dura para cierre: solo admin/finanzas pueden cerrar,
  // y solo si todas las reglas del checklist (CxC, CxP, docs, etc.) pasan.
  const cierreVisible = siguienteEstado === "Cerrado";
  const { data: validacionCierre } = useValidacionCierre(cierreVisible ? id : undefined);
  const rolPuedeCerrar = isAdmin || canEditFinance;
  const validacionOk = validacionCierre?.puede_cerrar === true;
  const bloqueoCierreMotivo = !cierreVisible
    ? null
    : !rolPuedeCerrar
      ? "rol"
      : !validacionOk
        ? "checklist"
        : null;

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
      syncEstadoMutate({ embarqueId, nuevoEstado: estadoCalculado, usuarioEmail: user?.email ?? '' });
    }
  }, [embarqueId, modo, tipo, etd, eta, estado, syncEstadoMutate, user?.email]);

  const conceptosSinProforma = conceptosVenta.filter(
    (c) => c.estado_facturacion !== "en_proforma",
  ).length;

  const [warnCierreOpen, setWarnCierreOpen] = useState(false);
  const [warnDocsOpen, setWarnDocsOpen] = useState(false);
  const [blockDocsOpen, setBlockDocsOpen] = useState(false);

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
      const msg = getErrorMessage(err);
      // El backend devuelve "documentos_faltantes: ...": mostramos block dialog.
      if (msg.includes("documentos_faltantes")) {
        setBlockDocsOpen(true);
        return;
      }
      notifyError(toast, { title: "Error al cambiar estado", description: msg, error: err, method: "HANDLE_AVANZAR_ESTADO" });
    }
  }, [embarque, id, avanzarEstado, user?.email, registrarActividad, toast]);

  const handleAvanzarEstado = async () => {
    if (!embarque || !id) return;
    const siguiente = getSiguienteEstado(embarque.estado);
    if (!siguiente) return;

    // 1) Candado HARD: faltan documentos para estado avanzado.
    if (docsBloqueantes && docsFaltantes.length > 0) {
      setBlockDocsOpen(true);
      return;
    }
    // 2) Candado SOFT por documentos: Confirmado / En Tránsito.
    if (!docsBloqueantes && docsFaltantes.length > 0) {
      setWarnDocsOpen(true);
      return;
    }
    // 3) v13.89.1 — Cierre: validación dura por rol y checklist administrativo.
    if (siguiente === "Cerrado" && bloqueoCierreMotivo !== null) {
      notifyError(toast, {
        title: bloqueoCierreMotivo === "rol"
          ? "Solo administración/finanzas pueden cerrar el embarque"
          : "Pendientes administrativos. Revisa el Tab Cierre.",
        method: "GATE_CERRAR_EMBARQUE",
      });
      return;
    }
    await ejecutarAvance(siguiente);
  };

  const confirmarCierreSinProforma = useCallback(async () => {
    // v13.89.1 — Mantiene compatibilidad de API; el flujo real ya valida server-side.
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
    // Candado de documentos
    docsFaltantes,
    docsBloqueantes,
    warnDocsOpen,
    setWarnDocsOpen,
    blockDocsOpen,
    setBlockDocsOpen,
    confirmarAvanceConDocsPendientes,
    siguienteEstado,
    // v13.89.1 — Cierre: visibilidad y bloqueo
    cierreEsSiguiente: cierreVisible,
    rolPuedeCerrar,
    cierrePuedeAvanzar: cierreVisible && bloqueoCierreMotivo === null,
    cierreMotivoBloqueo: bloqueoCierreMotivo,
  };
}
