import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/query";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import {
  fetchClientesPaginados,
  fetchClientes,
  fetchClientesForSelect,
  fetchCliente,
  createCliente,
  updateCliente,
  fetchContactosCliente,
  createContacto,
  updateContacto,
  deleteContacto,
  fetchEmbarquesCliente,
  fetchCotizacionesCliente,
} from "@/services/cliente";

export type Cliente = Tables<"clientes">;
export type ContactoCliente = Tables<"contactos_cliente">;

// --- Hook paginado server-side para la vista de lista ---

interface UseClientesPaginadosParams {
  search: string;
  page: number;
  pageSize: number;
}

export function useClientesPaginados({ search, page, pageSize }: UseClientesPaginadosParams) {
  const { organizationId } = useOrgFilter();
  const filters = { search, page, pageSize, organizationId };

  return useQuery({
    queryKey: queryKeys.clientes.list(filters),
    queryFn: () => fetchClientesPaginados({ search, page, pageSize, organizationId }),
    placeholderData: (prev) => prev,
  });
}


export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clientes.detail(id!),
    enabled: !!id,
    queryFn: () => fetchCliente(id!),
  });
}

export function useContactosCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clientes.contactos(clienteId!),
    enabled: !!clienteId,
    queryFn: () => fetchContactosCliente(clienteId!),
  });
}

export function useCreateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cliente: TablesInsert<"clientes">) => createCliente(cliente),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
    },
  });
}

export function useCreateContacto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contacto: TablesInsert<"contactos_cliente">) => createContacto(contacto),
    onSuccess: (_resultado, vars) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) }),
  });
}

export function useUpdateContacto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cliente_id, ...updates }: Partial<ContactoCliente> & { id: string; cliente_id: string }) =>
      updateContacto(id, updates),
    onSuccess: (_resultado, vars) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) }),
  });
}

export function useDeleteContacto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; cliente_id: string }) => deleteContacto(id),
    onSuccess: (_resultado, vars) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) }),
  });
}

export function useClientesForSelect() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.clientes.select, organizationId],
    queryFn: () => fetchClientesForSelect(organizationId),
  });
}

export function useEmbarquesCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clientes.embarques(clienteId!),
    enabled: !!clienteId,
    queryFn: () => fetchEmbarquesCliente(clienteId!),
  });
}

export function useCotizacionesCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clientes.cotizaciones(clienteId!),
    enabled: !!clienteId,
    queryFn: () => fetchCotizacionesCliente(clienteId!),
  });
}

export function useUpdateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<Cliente> & { id: string }) => updateCliente(id, updates),
    onSuccess: (clienteActualizado) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.detail(clienteActualizado.id) });
    },
  });
}
