/**
 * Tipos de dominio para el Portal Cliente.
 */

export interface NotificacionCliente {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  url: string | null;
  leida_at: string | null;
  embarque_id: string | null;
  factura_id: string | null;
  created_at: string;
}

/**
 * Vinculación usuario↔cliente del portal, con el nombre legible del cliente.
 * El join va por RLS: sólo devuelve los clientes que el usuario puede ver.
 */
export interface PortalClientUser {
  cliente_id: string;
  cliente_nombre: string | null;
  organization_id?: string | null;
  user_id?: string | null;
}
