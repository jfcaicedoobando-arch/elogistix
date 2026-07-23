import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TablesInsert } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/query";
import { useOrgFilter } from "@/hooks/shared";
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
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

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

// NOTA: el wizard de alta de cliente puede emitir su propio toast de éxito;
// aquí sólo añadimos onError como red de seguridad.
export function useCreateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cliente: TablesInsert<"clientes">) => createCliente(cliente),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear cliente: ${error.message}`, error, method: "CREATE_CLIENTE" });
    },
  });
}

export function useCreateContacto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contacto: TablesInsert<"contactos_cliente">) => createContacto(contacto),
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) });
      notifySuccess(undefined, { title: "Contacto creado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear contacto: ${error.message}`, error, method: "CREATE_CONTACTO" });
    },
  });
}

export function useUpdateContacto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cliente_id, ...updates }: Partial<ContactoCliente> & { id: string; cliente_id: string }) =>
      updateContacto(id, updates),
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) });
      notifySuccess(undefined, { title: "Contacto actualizado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar contacto: ${error.message}`, error, method: "UPDATE_CONTACTO" });
    },
  });
}

export function useDeleteContacto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; cliente_id: string }) => deleteContacto(id),
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) });
      notifySuccess(undefined, { title: "Contacto eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar contacto: ${error.message}`, error, method: "DELETE_CONTACTO" });
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

export function useUpdateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<Cliente> & { id: string }) => updateCliente(id, updates),
    onSuccess: (clienteActualizado) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.detail(clienteActualizado.id) });
      // Toast lo emite el caller (handler) para incluir contexto; evitar doble notificación.
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar cliente: ${error.message}`, error, method: "UPDATE_CLIENTE" });
    },
  });
}
