import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

export type Cliente = Tables<'clientes'>;
export type ContactoCliente = Tables<'contactos_cliente'>;

/** Columnas necesarias para la tabla de clientes y reportes */
const CLIENTE_LIST_COLUMNS = 'id, nombre, rfc, ciudad, estado, contacto, telefono' as const;

export function useClientes() {
  return useQuery({
    queryKey: queryKeys.clientes.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select(CLIENTE_LIST_COLUMNS)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clientes.detail(id!),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useContactosCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clientes.contactos(clienteId!),
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contactos_cliente")
        .select("*")
        .eq("cliente_id", clienteId!)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cliente: TablesInsert<"clientes">) => {
      const { data, error } = await supabase
        .from("clientes")
        .insert(cliente)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
    },
  });
}

export function useCreateContacto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contacto: TablesInsert<"contactos_cliente">) => {
      const { data, error } = await supabase
        .from("contactos_cliente")
        .insert(contacto)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_resultado, vars) => queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) }),
  });
}

export function useUpdateContacto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cliente_id, ...updates }: Partial<ContactoCliente> & { id: string; cliente_id: string }) => {
      const { error } = await supabase
        .from("contactos_cliente")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_resultado, vars) => queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) }),
  });
}

export function useDeleteContacto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cliente_id }: { id: string; cliente_id: string }) => {
      const { error } = await supabase
        .from("contactos_cliente")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_resultado, vars) => queryClient.invalidateQueries({ queryKey: queryKeys.clientes.contactos(vars.cliente_id) }),
  });
}

export function useClientesForSelect() {
  return useQuery({
    queryKey: queryKeys.clientes.select,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre')
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Cliente> & { id: string }) => {
      const { data, error } = await supabase
        .from("clientes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (clienteActualizado) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.detail(clienteActualizado.id) });
    },
  });
}
