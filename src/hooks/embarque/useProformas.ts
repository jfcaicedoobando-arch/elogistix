/**
 * Hooks de proformas: solo orquestación de React Query (cache + toasts).
 * La lógica de negocio vive en `services/proformaServices.ts` y `lib/domain/proforma.ts`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOrgFilter } from "@/hooks/useOrgFilter";
import { queryKeys } from "@/lib/queryKeys";
import {
  aprobarProformas as svcAprobar,
  consolidarProformas as svcConsolidar,
  crearProforma as svcCrear,
  eliminarProforma as svcEliminar,
  fetchProformasAprobadas,
  fetchProformasEmbarque,
  fetchProformasPendientes,
  marcarProformaFacturada as svcMarcarFacturada,
  type ConsolidarProformasParams,
  type CrearProformaParams,
  type EliminarProformaParams,
  type MarcarFacturadaParams,
  type ProformaConFactura,
  type ProformaPendienteConEmbarque,
  type ProformaRow,
} from "@/services/proformaServices";

// Re-export tipos para que componentes/pages no tengan que importar del service.
export type { ProformaConFactura, ProformaPendienteConEmbarque, ProformaRow };

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

export function useProformas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.proformas.aprobadas(organizationId),
    enabled: !!organizationId,
    queryFn: () => fetchProformasAprobadas(organizationId!),
    staleTime: 30_000,
  });
}

export function useProformasPendientes() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.proformas.pendientes(organizationId),
    enabled: !!organizationId,
    queryFn: () => fetchProformasPendientes(organizationId!),
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
      toast.success(`Proforma ${proforma.numero} generada (pendiente de revisión)`);
      invalidateProformaCaches(queryClient, proforma.embarque_id);
    },
    onError: (error: Error) => {
      toast.error(`Error al generar proforma: ${error.message}`);
    },
  });
}

export function useMarcarProformaFacturada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: MarcarFacturadaParams & { embarqueId: string }) =>
      svcMarcarFacturada(params).then(() => params),
    onSuccess: (params) => {
      toast.success("Proforma facturada y registro de factura creado");
      invalidateProformaCaches(queryClient, params.embarqueId);
      queryClient.invalidateQueries({ queryKey: queryKeys.facturas.all });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });
}

export function useEliminarProforma() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: EliminarProformaParams & { numero: string }) =>
      svcEliminar(params).then(() => params),
    onSuccess: (params) => {
      toast.success("Proforma eliminada correctamente");
      invalidateProformaCaches(queryClient, params.embarqueId);
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar proforma: ${error.message}`);
    },
  });
}

export function useAprobarProformas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { proformaIds: string[] }) =>
      svcAprobar(params.proformaIds).then(() => params),
    onSuccess: (params) => {
      toast.success(
        params.proformaIds.length === 1
          ? "Proforma aprobada"
          : `${params.proformaIds.length} proformas aprobadas`,
      );
      invalidateProformaCaches(queryClient);
    },
    onError: (error: Error) => {
      toast.error(`Error al aprobar: ${error.message}`);
    },
  });
}

export function useConsolidarProformas() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrgFilter();
  return useMutation({
    mutationFn: (params: Omit<ConsolidarProformasParams, "organizationId">) => {
      if (!organizationId) throw new Error("Organización no disponible");
      return svcConsolidar({ ...params, organizationId });
    },
    onSuccess: (nueva) => {
      toast.success(`Proformas consolidadas en ${nueva.numero}`);
      invalidateProformaCaches(queryClient, nueva.embarque_id);
    },
    onError: (error: Error) => {
      toast.error(`Error al consolidar: ${error.message}`);
    },
  });
}
