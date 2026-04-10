import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePortalEmbarques(clienteIds: string[]) {
  return useQuery({
    queryKey: ["portal", "embarques", clienteIds],
    queryFn: async () => {
      if (!clienteIds.length) return [];
      const { data, error } = await supabase
        .from("embarques")
        .select("id, expediente, cliente_nombre, modo, tipo, estado, etd, eta, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, tipo_servicio, naviera, aerolinea, transportista, contenedor, tipo_contenedor, created_at")
        .in("cliente_id", clienteIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: clienteIds.length > 0,
  });
}

export function usePortalEmbarque(id?: string) {
  return useQuery({
    queryKey: ["portal", "embarque", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("embarques")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function usePortalEventos(embarqueId?: string) {
  return useQuery({
    queryKey: ["portal", "eventos", embarqueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos_embarque")
        .select("*")
        .eq("embarque_id", embarqueId!)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!embarqueId,
  });
}

export function usePortalDocumentos(embarqueId?: string) {
  return useQuery({
    queryKey: ["portal", "documentos", embarqueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos_embarque")
        .select("*")
        .eq("embarque_id", embarqueId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!embarqueId,
  });
}

export function usePortalCotizaciones(clienteIds: string[]) {
  return useQuery({
    queryKey: ["portal", "cotizaciones", clienteIds],
    queryFn: async () => {
      if (!clienteIds.length) return [];
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("id, folio, cliente_nombre, modo, tipo, estado, moneda, subtotal, origen, destino, created_at, fecha_vigencia")
        .in("cliente_id", clienteIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: clienteIds.length > 0,
  });
}

export function usePortalFacturas(clienteIds: string[]) {
  return useQuery({
    queryKey: ["portal", "facturas", clienteIds],
    queryFn: async () => {
      if (!clienteIds.length) return [];
      const { data, error } = await supabase
        .from("facturas")
        .select("id, numero, expediente, cliente_nombre, estado, moneda, subtotal, iva, total, fecha_emision, fecha_vencimiento")
        .in("cliente_id", clienteIds)
        .order("fecha_emision", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: clienteIds.length > 0,
  });
}

export function usePortalClientUsers() {
  return useQuery({
    queryKey: ["portal", "client_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_users")
        .select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePortalClienteName() {
  return useQuery({
    queryKey: ["portal", "cliente_nombre"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("client_users")
        .select("cliente_id, clientes(nombre)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const clientes = data?.clientes as unknown as { nombre: string } | null;
      return clientes?.nombre ?? null;
    },
  });
}

export function usePortalOrgName() {
  return useQuery({
    queryKey: ["portal", "org_name"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("client_users")
        .select("organizations(nombre)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const org = data?.organizations as unknown as { nombre: string } | null;
      return org?.nombre ?? null;
    },
  });
}

export function usePortalCotizacion(id?: string) {
  return useQuery({
    queryKey: ["portal", "cotizacion", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}
