// Re-export types from Supabase generated types for convenience
import type { Database } from '@/integrations/supabase/types';

// Enum types
export type ModoTransporte = Database['public']['Enums']['modo_transporte'];
export type TipoOperacion = Database['public']['Enums']['tipo_operacion'];
export type EstadoEmbarque = Database['public']['Enums']['estado_embarque'];
export type EstadoDocumento = Database['public']['Enums']['estado_documento'];
export type EstadoFactura = Database['public']['Enums']['estado_factura'];
export type EstadoLiquidacion = Database['public']['Enums']['estado_liquidacion'];
export type Moneda = Database['public']['Enums']['moneda'];
export type TipoProveedor = Database['public']['Enums']['tipo_proveedor'];
export type TipoServicioMaritimo = Database['public']['Enums']['tipo_servicio_maritimo'];
export type Incoterm = Database['public']['Enums']['incoterm'];
export type TipoContacto = Database['public']['Enums']['tipo_contacto'];
export type TipoContenedor = string;

// Row types (for components that still reference the old interfaces)
export type Cliente = Database['public']['Tables']['clientes']['Row'];
export type Proveedor = Database['public']['Tables']['proveedores']['Row'];
export type ContactoCliente = Database['public']['Tables']['contactos_cliente']['Row'];

// Legacy interface kept for NuevoProveedorDialog document step
export interface DocumentoProveedor {
  nombre: string;
  archivo?: string;
  adjuntado: boolean;
}
