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
