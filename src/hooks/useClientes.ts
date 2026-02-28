import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Cliente, ContactoCliente, TipoContacto } from "@/data/types";

// Map DB row to app type
function mapCliente(row: any): Cliente {
  return {
    id: row.id,
    nombre: row.nombre,
    rfc: row.rfc,
    direccion: row.direccion,
    ciudad: row.ciudad,
    estado: row.estado,
    cp: row.cp,
    contacto: row.contacto,
    email: row.email,
    telefono: row.telefono,
  };
}

function mapContacto(row: any): ContactoCliente {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    nombre: row.nombre,
    rfc: row.rfc,
    tipo: row.tipo as TipoContacto,
    pais: row.pais,
    ciudad: row.ciudad,
    direccion: row.direccion,
    contacto: row.contacto,
    email: row.email,
    telefono: row.telefono,
  };
}

export function useClientes() {
  return useQuery({
    queryKey: ["clientes"],
    queryFn: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return (data || []).map(mapCliente);
    },
  });
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: ["clientes", id],
    enabled: !!id,
    queryFn: async (): Promise<Cliente | null> => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data ? mapCliente(data) : null;
    },
  });
}

export function useContactosCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["contactos_cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<ContactoCliente[]> => {
      const { data, error } = await supabase
        .from("contactos_cliente")
        .select("*")
        .eq("cliente_id", clienteId!)
        .order("nombre");
      if (error) throw error;
      return (data || []).map(mapContacto);
    },
  });
}

export function useCreateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cliente: Omit<Cliente, "id">) => {
      const { data, error } = await supabase
        .from("clientes")
        .insert({
          nombre: cliente.nombre,
          rfc: cliente.rfc,
          direccion: cliente.direccion,
          ciudad: cliente.ciudad,
          estado: cliente.estado,
          cp: cliente.cp,
          contacto: cliente.contacto,
          email: cliente.email,
          telefono: cliente.telefono,
        })
        .select()
        .single();
      if (error) throw error;
      return mapCliente(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  });
}

export function useCreateContacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contacto: Omit<ContactoCliente, "id">) => {
      const { data, error } = await supabase
        .from("contactos_cliente")
        .insert({
          cliente_id: contacto.clienteId,
          nombre: contacto.nombre,
          rfc: contacto.rfc,
          tipo: contacto.tipo,
          pais: contacto.pais,
          ciudad: contacto.ciudad,
          direccion: contacto.direccion,
          contacto: contacto.contacto,
          email: contacto.email,
          telefono: contacto.telefono,
        })
        .select()
        .single();
      if (error) throw error;
      return mapContacto(data);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["contactos_cliente", vars.clienteId] }),
  });
}

export function useUpdateContacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clienteId, ...updates }: Partial<ContactoCliente> & { id: string; clienteId: string }) => {
      const { error } = await supabase
        .from("contactos_cliente")
        .update({
          nombre: updates.nombre,
          rfc: updates.rfc,
          tipo: updates.tipo,
          pais: updates.pais,
          ciudad: updates.ciudad,
          direccion: updates.direccion,
          contacto: updates.contacto,
          email: updates.email,
          telefono: updates.telefono,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["contactos_cliente", vars.clienteId] }),
  });
}

export function useDeleteContacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clienteId }: { id: string; clienteId: string }) => {
      const { error } = await supabase
        .from("contactos_cliente")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["contactos_cliente", vars.clienteId] }),
  });
}
