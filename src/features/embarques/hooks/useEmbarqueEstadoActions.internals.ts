import { useEffect, useMemo } from "react";
import {
  useSyncEstadoEmbarque,
  calcularEstadoEmbarque,
  type EmbarqueRow,
} from "@/features/embarques/hooks/useEmbarques";
import { useValidacionCierre } from "@/features/embarques/hooks/useCierreEmbarque";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { resolveCierreGate } from "./useEmbarqueEstadoActions.helpers";

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

function pickAutoSyncFields(embarque: EmbarqueRow | undefined) {
  if (!embarque) return null;
  return {
    embarqueId: embarque.id,
    modo: embarque.modo,
    tipo: embarque.tipo,
    estado: embarque.estado,
    etd: embarque.etd ?? null,
    eta: embarque.eta ?? null,
    fechaLlegadaReal: embarque.fecha_llegada_real ?? null,
  };
}

/**
 * Auto-sync del estado calculado a BD. Se aísla en su propio hook para
 * mantener la complejidad ciclomática del hook principal bajo control.
 */
export function useAutoSyncEstadoEmbarque(
  embarque: EmbarqueRow | undefined,
  puedeSincronizarEstado: boolean,
  usuarioEmail: string,
) {
  const { mutate: syncEstadoMutate } = useSyncEstadoEmbarque();
  const f = useMemo(() => pickAutoSyncFields(embarque), [embarque]);
  useEffect(() => {
    if (!puedeSincronizarEstado || !f) return;
    runAutoSyncEstado({ ...f, usuarioEmail, sync: syncEstadoMutate });
  }, [puedeSincronizarEstado, f, syncEstadoMutate, usuarioEmail]);
}

/**
 * Consolida las variables derivadas del "gate de cierre" en un solo objeto.
 * Extraído de `useEmbarqueEstadoActions` para reducir su complejidad ciclomática.
 */
export function useCierreGate(siguienteEstado: string | null, id: string | undefined) {
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
