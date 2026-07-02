/**
 * Servicio: portal público de proformas.
 * Usa RPC `portal_obtener_proforma_por_token` y `portal_responder_por_token`
 * accesibles con clave anon (sin login del cliente).
 */
import { supabase } from "@/integrations/supabase/client";

export type EstadoLink = "activo" | "expirado" | "respondida";

export interface PortalProformaConcepto {
  id: string;
  descripcion: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  importe: number | null;
  moneda: string | null;
}

export interface PortalProformaData {
  id: string;
  numero: string | null;
  cliente_nombre: string | null;
  expediente: string | null;
  moneda: string | null;
  subtotal: number | null;
  iva: number | null;
  total: number | null;
  estado_cliente: "pendiente" | "aceptada" | "rechazada";
  aceptada_at: string | null;
  rechazada_at: string | null;
  motivo_rechazo: string | null;
  created_at: string;
  token_expira_at: string | null;
}

export interface PortalProformaResponse {
  estado_link: EstadoLink | "token_invalido";
  proforma: PortalProformaData | null;
  conceptos: PortalProformaConcepto[];
}

type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function fetchPortalProforma(token: string): Promise<PortalProformaResponse> {
  const { data, error } = await (supabase.rpc as unknown as RpcFn)(
    "portal_obtener_proforma_por_token",
    { p_token: token },
  );
  if (error) throw new Error(error.message);
  const raw = (data ?? {}) as Record<string, unknown>;
  if ((raw as { error?: string }).error === "token_invalido") {
    return { estado_link: "token_invalido", proforma: null, conceptos: [] };
  }
  return {
    estado_link: (raw.estado_link as EstadoLink) ?? "activo",
    proforma: (raw.proforma as PortalProformaData | null) ?? null,
    conceptos: (raw.conceptos as PortalProformaConcepto[]) ?? [],
  };
}

export async function responderPortalProforma(
  token: string,
  respuesta: "aceptada" | "rechazada",
  motivo = "",
): Promise<{ id: string; estado_cliente: string; respondida_at: string }> {
  const { data, error } = await (supabase.rpc as unknown as RpcFn)(
    "portal_responder_por_token",
    { p_token: token, p_respuesta: respuesta, p_motivo: motivo },
  );
  if (error) throw new Error(error.message);
  return data as { id: string; estado_cliente: string; respondida_at: string };
}
