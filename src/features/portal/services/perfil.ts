import { supabase } from "@/integrations/supabase/client";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";

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

export async function fetchPortalPerfil(): Promise<PortalPerfilData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error(AUTH_ERROR_MESSAGES.notAuthenticated);

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

export async function actualizarContactoPortal(input: {
  nombre: string;
  telefono: string;
}) {
  const { error } = await supabase.rpc("portal_update_contacto", {
    _nombre: input.nombre,
    _telefono: input.telefono,
  });
  if (error) throw error;
}

export async function cambiarPasswordPortal(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
