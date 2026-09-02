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
  fetchPortalFactura,
  fetchPortalPagosFactura,
  fetchPortalNotasCreditoFactura,
  fetchResumenSaldoFacturaPortal,
  fetchPortalClientUsers,
  fetchPortalClienteName,
  fetchPortalContactoNombre,
  fetchPortalOrgName,
} from "@/features/portal/services";

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

export function usePortalFactura(id?: string) {
  return useQuery({
    queryKey: queryKeys.portal.factura(id ?? ""),
    queryFn: () => fetchPortalFactura(id!),
    enabled: !!id,
  });
}

export function usePortalPagosFactura(facturaId?: string) {
  return useQuery({
    queryKey: queryKeys.portal.pagosFactura(facturaId ?? ""),
    queryFn: () => fetchPortalPagosFactura(facturaId!),
    enabled: !!facturaId,
  });
}

// Defecto 7: el saldo viene del agregado completo en BD, nunca de las listas
// truncadas por `PORTAL_RELATED_MAX`.
export function usePortalResumenSaldoFactura(facturaId?: string) {
  return useQuery({
    queryKey: queryKeys.portal.resumenSaldoFactura(facturaId ?? ""),
    queryFn: () => fetchResumenSaldoFacturaPortal(facturaId!),
    enabled: !!facturaId,
  });
}

// B-082: las NC aplicadas se descuentan del saldo mostrado al cliente.
export function usePortalNotasCreditoFactura(facturaId?: string) {
  return useQuery({
    queryKey: queryKeys.portal.notasCreditoFactura(facturaId ?? ""),
    queryFn: () => fetchPortalNotasCreditoFactura(facturaId!),
    enabled: !!facturaId,
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

export function usePortalContactoNombre() {
  return useQuery({
    queryKey: queryKeys.portal.contactoName,
    queryFn: fetchPortalContactoNombre,
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
