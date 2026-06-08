import type { Enums } from "@/integrations/supabase/types";
type TipoProveedor = Enums<'tipo_proveedor'>;
type Moneda = Enums<'moneda'>;

export const TIPOS_PROVEEDOR: TipoProveedor[] = [
  'Naviera', 'Aerolínea', 'Transportista', 'Agente Aduanal', 'Agente de Carga',
  'Aseguradora', 'Custodia', 'Almacenes', 'Acondicionamiento de Carga', 'Materiales Peligrosos',
];

export const MONEDAS_PROVEEDOR: Moneda[] = ['MXN', 'USD', 'EUR'];

export const PAISES_PROVEEDOR = [
  'México', 'Estados Unidos', 'Canadá', 'China', 'Alemania', 'España',
  'Francia', 'Italia', 'Japón', 'Corea del Sur', 'Brasil', 'Colombia',
  'Chile', 'Argentina', 'Perú', 'Reino Unido', 'India', 'Otro',
];

/**
 * Métodos de pago a proveedor. SPEI sólo aplica a proveedores nacionales
 * (transferencia interbancaria mexicana). Transferencia internacional /
 * SWIFT aplica a proveedores extranjeros.
 */
export const METODOS_PAGO_PROVEEDOR = [
  'SPEI',
  'Transferencia internacional',
  'Transferencia',
  'Cheque',
  'Efectivo',
  'Tarjeta',
  'Otro',
] as const;

export type MetodoPagoProveedor = typeof METODOS_PAGO_PROVEEDOR[number];

export const ORIGENES_PROVEEDOR = ['Nacional', 'Extranjero'] as const;
export type OrigenProveedor = typeof ORIGENES_PROVEEDOR[number];
