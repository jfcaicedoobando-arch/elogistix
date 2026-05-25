/**
 * Tipos de dominio para Clientes (capa neutra).
 * Re-exportados por `hooks/cliente/useClientes` para preservar la API pública.
 */
import type { Tables } from "@/integrations/supabase/types";

export type Cliente = Tables<"clientes">;
export type ContactoCliente = Tables<"contactos_cliente">;
