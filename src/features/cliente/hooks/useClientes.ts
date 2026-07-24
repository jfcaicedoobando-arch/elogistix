import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TablesInsert } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/query";
import { useOrgFilter, useMutationWithFeedback } from "@/hooks/shared";
import {
  fetchClientesPaginados,
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
} from "@/features/cliente/services";
import type { Cliente, ContactoCliente } from "@/features/cliente/types/cliente";

export type { Cliente, ContactoCliente } from "@/features/cliente/types/cliente";

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

// NOTA: el wizard de alta de cliente emite su propio toast de éxito; el wrapper
// se limita a invalidar y a reportar errores traducidos por `getErrorMessage`.
export function useCreateCliente() {
  return useMutationWithFeedback({
    mutationFn: (cliente: TablesInsert<"clientes">) => createCliente(cliente),
    invalidate: queryKeys.clientes.all,
    errorTitle: "Error al crear cliente",
    errorMethod: "CREATE_CLIENTE",
  });
}

export function useCreateContacto() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    mutationFn: (contacto: TablesInsert<"contactos_cliente">) => createContacto(contacto),
    successTitle: "Contacto creado",
    errorTitle: "Error al crear contacto",
    errorMethod: "CREATE_CONTACTO",
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) });
    },
  });
}

export function useUpdateContacto() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    mutationFn: ({ id, cliente_id: _cid, ...updates }: Partial<ContactoCliente> & { id: string; cliente_id: string }) =>
      updateContacto(id, updates),
    successTitle: "Contacto actualizado",
    errorTitle: "Error al actualizar contacto",
    errorMethod: "UPDATE_CONTACTO",
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) });
    },
  });
}

export function useDeleteContacto() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    mutationFn: ({ id }: { id: string; cliente_id: string }) => deleteContacto(id),
    successTitle: "Contacto eliminado",
    errorTitle: "Error al eliminar contacto",
    errorMethod: "DELETE_CONTACTO",
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) });
    },
  });
}

export function useClientesForSelect() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.clientes.selectByOrg(organizationId),
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

// NOTA: el caller (handler de detalle) emite el toast con contexto extra
// (nombre del cliente); aquí sólo invalidamos y reportamos errores traducidos.
export function useUpdateCliente() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    mutationFn: ({ id, ...updates }: Partial<Cliente> & { id: string }) => updateCliente(id, updates),
    invalidate: queryKeys.clientes.all,
    errorTitle: "Error al actualizar cliente",
    errorMethod: "UPDATE_CLIENTE",
    onSuccess: (clienteActualizado) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.detail(clienteActualizado.id) });
    },
  });
}
