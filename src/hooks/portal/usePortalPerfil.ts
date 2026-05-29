import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query";

export interface PortalPerfilData {
  email: string;
  cliente: {
    id: string;
    nombre: string;
    rfc: string;
    direccion: string;
    ciudad: string;
    estado: string;
    cp: string;
    contacto: string;
    email: string;
    telefono: string;
  } | null;
}

async function fetchPortalPerfil(): Promise<PortalPerfilData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data, error } = await supabase
    .from("client_users")
    .select(
      "clientes(id, nombre, rfc, direccion, ciudad, estado, cp, contacto, email, telefono)",
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    email: user.email ?? "",
    cliente: (data?.clientes as PortalPerfilData["cliente"]) ?? null,
  };
}

export function usePortalPerfil() {
  return useQuery({
    queryKey: queryKeys.portal.perfil,
    queryFn: fetchPortalPerfil,
  });
}

export function useActualizarContactoPortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nombre: string; telefono: string }) => {
      const { error } = await supabase.rpc("portal_update_contacto", {
        _nombre: input.nombre,
        _telefono: input.telefono,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.portal.perfil });
    },
  });
}

export function useCambiarPasswordPortal() {
  return useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
  });
}
