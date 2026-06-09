import type { Enums } from "@/integrations/supabase/types";
type TipoProveedor = Enums<'tipo_proveedor'>;
type Moneda = Enums<'moneda'>;
type CategoriaProveedor = Enums<'categoria_proveedor'>;
type SubtipoGasto = Enums<'subtipo_gasto_operativo'>;

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
 * Categorías y subtipos de proveedor.
 * - `Logistico`: usa el enum `tipo` (Naviera, Aerolínea, etc.).
 * - `GastoOperativo`: usa `subtipo_gasto` para clasificar gastos administrativos del ERP.
 */
export const CATEGORIAS_PROVEEDOR: { value: CategoriaProveedor; label: string }[] = [
  { value: 'Logistico', label: 'Logístico' },
  { value: 'GastoOperativo', label: 'Gasto operativo' },
];

export const SUBTIPOS_GASTO_OPERATIVO: { value: SubtipoGasto; label: string }[] = [
  { value: 'Renta', label: 'Renta' },
  { value: 'Servicios', label: 'Servicios (luz, agua, internet)' },
  { value: 'Papeleria', label: 'Papelería y oficina' },
  { value: 'Software', label: 'Software / SaaS' },
  { value: 'Honorarios', label: 'Honorarios profesionales' },
  { value: 'Mantenimiento', label: 'Mantenimiento' },
  { value: 'Marketing', label: 'Marketing y publicidad' },
  { value: 'Viaticos', label: 'Viáticos' },
  { value: 'Otros', label: 'Otros' },
];

export function labelCategoria(c: CategoriaProveedor | null | undefined): string {
  if (!c) return '—';
  return CATEGORIAS_PROVEEDOR.find((x) => x.value === c)?.label ?? c;
}

export function labelSubtipoGasto(s: SubtipoGasto | null | undefined): string {
  if (!s) return '—';
  return SUBTIPOS_GASTO_OPERATIVO.find((x) => x.value === s)?.label ?? s;
}

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
