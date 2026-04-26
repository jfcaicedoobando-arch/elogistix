import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchPortalEmbarques,
  fetchPortalEmbarque,
  fetchPortalEventos,
  fetchPortalDocumentos,
  fetchPortalCotizaciones,
  fetchPortalCotizacion,
  fetchPortalFacturas,
  fetchPortalClientUsers,
  fetchPortalClienteName,
  fetchPortalOrgName,
} from "@/services/portal/queries";

export function usePortalEmbarques(clienteIds: string[]) {
  return useQuery({
    queryKey: queryKeys.portal.embarques(clienteIds),
    queryFn: () => fetchPortalEmbarques(clienteIds),
    enabled: clienteIds.length > 0,
  });
}

export function usePortalEmbarque(id?: string) {
  return useQuery({
    queryKey: queryKeys.portal.embarque(id ?? ""),
    queryFn: () => fetchPortalEmbarque(id!),
    enabled: !!id,
  });
}

export function usePortalEventos(embarqueId?: string) {
  return useQuery({
    queryKey: queryKeys.portal.eventos(embarqueId ?? ""),
    queryFn: () => fetchPortalEventos(embarqueId!),
    enabled: !!embarqueId,
  });
}

export function usePortalDocumentos(embarqueId?: string) {
  return useQuery({
    queryKey: queryKeys.portal.documentos(embarqueId ?? ""),
    queryFn: () => fetchPortalDocumentos(embarqueId!),
    enabled: !!embarqueId,
  });
}

export function usePortalCotizaciones(clienteIds: string[]) {
  return useQuery({
    queryKey: queryKeys.portal.cotizaciones(clienteIds),
    queryFn: () => fetchPortalCotizaciones(clienteIds),
    enabled: clienteIds.length > 0,
  });
}

export function usePortalFacturas(clienteIds: string[]) {
  return useQuery({
    queryKey: queryKeys.portal.facturas(clienteIds),
    queryFn: () => fetchPortalFacturas(clienteIds),
    enabled: clienteIds.length > 0,
  });
}

export function usePortalClientUsers() {
  return useQuery({
    queryKey: queryKeys.portal.clientUsers,
    queryFn: fetchPortalClientUsers,
  });
}

export function usePortalClienteName() {
  return useQuery({
    queryKey: queryKeys.portal.clienteName,
    queryFn: fetchPortalClienteName,
  });
}

export function usePortalOrgName() {
  return useQuery({
    queryKey: queryKeys.portal.orgName,
    queryFn: fetchPortalOrgName,
  });
}

export function usePortalCotizacion(id?: string) {
  return useQuery({
    queryKey: queryKeys.portal.cotizacion(id ?? ""),
    queryFn: () => fetchPortalCotizacion(id!),
    enabled: !!id,
  });
}
