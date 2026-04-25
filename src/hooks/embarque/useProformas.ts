/**
 * Hooks de proformas: solo orquestación de React Query (cache + toasts).
 * La lógica de negocio vive en `services/proformaServices.ts` y `lib/domain/proforma.ts`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOrgFilter } from "@/hooks/useOrgFilter";
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
    queryKey: ["proformas", "embarque", embarqueId],
    enabled: !!embarqueId,
    queryFn: () => fetchProformasEmbarque(embarqueId!),
    staleTime: 30_000,
  });
}

export function useProformas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: ["proformas", "all", organizationId],
    enabled: !!organizationId,
    queryFn: () => fetchProformasAprobadas(organizationId!),
    staleTime: 30_000,
  });
}

export function useProformasPendientes() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: ["proformas", "pendientes", organizationId],
    enabled: !!organizationId,
    queryFn: () => fetchProformasPendientes(organizationId!),
    staleTime: 30_000,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────────────────

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
      queryClient.invalidateQueries({ queryKey: ["proformas", "embarque", proforma.embarque_id] });
      queryClient.invalidateQueries({ queryKey: ["proformas", "pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["embarque", proforma.embarque_id] });
      queryClient.invalidateQueries({ queryKey: ["conceptos_venta"] });
      queryClient.invalidateQueries({ queryKey: ["embarques"] });
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
      queryClient.invalidateQueries({ queryKey: ["proformas", "all"] });
      queryClient.invalidateQueries({ queryKey: ["proformas", "embarque", params.embarqueId] });
      queryClient.invalidateQueries({ queryKey: ["facturas"] });
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
      queryClient.invalidateQueries({ queryKey: ["proformas", "embarque", params.embarqueId] });
      queryClient.invalidateQueries({ queryKey: ["proformas", "all"] });
      queryClient.invalidateQueries({ queryKey: ["embarque", params.embarqueId] });
      queryClient.invalidateQueries({ queryKey: ["conceptos_venta"] });
      queryClient.invalidateQueries({ queryKey: ["embarques"] });
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
      queryClient.invalidateQueries({ queryKey: ["proformas"] });
      queryClient.invalidateQueries({ queryKey: ["embarque"] });
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
      queryClient.invalidateQueries({ queryKey: ["proformas"] });
      queryClient.invalidateQueries({ queryKey: ["embarque"] });
    },
    onError: (error: Error) => {
      toast.error(`Error al consolidar: ${error.message}`);
    },
  });
}
