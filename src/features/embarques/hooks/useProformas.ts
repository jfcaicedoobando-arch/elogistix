/**
 * Hooks de proformas: solo orquestación de React Query (cache + toasts).
 * La lógica de negocio vive en `services/proformaServices.ts` y `lib/domain/proforma.ts`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import {
  crearProforma as svcCrear,
  eliminarProforma as svcEliminar,
  fetchProformasTodas,
  fetchProformasEmbarque,
  
  type CrearProformaParams,
  type EliminarProformaParams,
  type ProformaConFactura,
  type ProformaRow,
} from "@/features/proformas/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

// Re-export tipos para que componentes/pages no tengan que importar del service.
export type { ProformaConFactura,  ProformaRow };

// ──────────────────────────────────────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────────────────────────────────────

export function useProformasEmbarque(embarqueId?: string) {
  return useQuery({
    queryKey: queryKeys.proformas.embarque(embarqueId),
    enabled: !!embarqueId,
    queryFn: () => fetchProformasEmbarque(embarqueId!),
    staleTime: 30_000,
  });
}

/**
 * Listado completo de proformas de la organización (pendientes, aprobadas y
 * facturadas). Los filtros por estado se aplican en la UI (`useTabProformasState`).
 */
export function useProformas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.proformas.aprobadas(organizationId),
    enabled: !!organizationId,
    queryFn: () => fetchProformasTodas(organizationId!),
    staleTime: 30_000,
  });
}


// ──────────────────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────────────────

/** Invalida todas las queries impactadas por cambios en proformas. */
function invalidateProformaCaches(qc: ReturnType<typeof useQueryClient>, embarqueId?: string | null) {
  qc.invalidateQueries({ queryKey: queryKeys.proformas.all });
  qc.invalidateQueries({ queryKey: queryKeys.proformas.conceptosVenta });
  qc.invalidateQueries({ queryKey: queryKeys.embarques.all });
  if (embarqueId) {
    qc.invalidateQueries({ queryKey: queryKeys.proformas.embarque(embarqueId) });
    qc.invalidateQueries({ queryKey: queryKeys.embarques.detail(embarqueId) });
  }
}

export function useCrearProforma() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrgFilter();
  return useMutation({
    mutationFn: (params: Omit<CrearProformaParams, "organizationId">) => {
      if (!organizationId) throw new Error("Organización no disponible");
      return svcCrear({ ...params, organizationId });
    },
    onSuccess: (proforma) => {
      notifySuccess(undefined, { title: `Proforma ${proforma.numero} generada (pendiente de revisión)` });
      invalidateProformaCaches(queryClient, proforma.embarque_id);
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al generar proforma: ${error.message}`, error, method: "CREATE_PROFORMA" });
    },
  });
}


/** Mensaje que devuelve `soft_delete_record` cuando la fila ya está en papelera. */
const YA_BORRADA = "Registro no encontrado o ya borrado";

export function useEliminarProforma() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: EliminarProformaParams & { numero: string }) =>
      svcEliminar(params).then(() => params),
    onSuccess: (params) => {
      notifySuccess(undefined, { title: "Proforma eliminada correctamente" });
      invalidateProformaCaches(queryClient, params.embarqueId);
    },
    onError: (error: Error, params) => {
      // Fila fantasma: la proforma ya estaba en papelera y la lista venía de
      // caché. Se refresca en vez de mostrar un error técnico.
      if (error.message.includes(YA_BORRADA)) {
        notifyWarning(undefined, {
          title: "Esta proforma ya había sido eliminada; se actualizó la lista",
        });
        invalidateProformaCaches(queryClient, params.embarqueId);
        return;
      }
      notifyError(undefined, { title: `Error al eliminar proforma: ${error.message}`, error, method: "DELETE_PROFORMA" });
    },
  });
}


