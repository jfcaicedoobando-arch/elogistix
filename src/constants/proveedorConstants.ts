import type { Enums } from "@/integrations/supabase/types";
type TipoProveedor = Enums<'tipo_proveedor'>;
type Moneda = Enums<'moneda'>;
type SubtipoGasto = Enums<'subtipo_gasto_operativo'>;

export const TIPOS_PROVEEDOR: TipoProveedor[] = [
  'Naviera', 'Aerolínea', 'Transportista', 'Agente Aduanal', 'Agente de Carga',
  'Aseguradora', 'Custodia', 'Almacenes', 'Acondicionamiento de Carga', 'Materiales Peligrosos',
];

/**
 * Tipos permitidos para proveedores con `origen_proveedor = 'Extranjero'`.
 * Los demás tipos sólo aplican a proveedores nacionales.
 */
export const TIPOS_PROVEEDOR_EXTRANJERO: TipoProveedor[] = [
  'Naviera', 'Aerolínea', 'Agente de Carga',
];

/**
 * Devuelve la lista de tipos disponible según el origen del proveedor.
 * Si `tipoActual` no está en la lista filtrada (dato legacy), se incluye
 * para no romper la edición de proveedores existentes.
 */
export function tiposProveedorPorOrigen(
  origen: 'Nacional' | 'Extranjero' | null | undefined,
  tipoActual?: TipoProveedor | null,
): TipoProveedor[] {
  if (origen !== 'Extranjero') return TIPOS_PROVEEDOR;
  const base = [...TIPOS_PROVEEDOR_EXTRANJERO];
  if (tipoActual && !base.includes(tipoActual)) base.push(tipoActual);
  return base;
}

export const MONEDAS_PROVEEDOR: Moneda[] = ['MXN', 'USD', 'EUR'];

export const PAISES_PROVEEDOR = [
  'México', 'Estados Unidos', 'Canadá', 'China', 'Alemania', 'España',
  'Francia', 'Italia', 'Japón', 'Corea del Sur', 'Brasil', 'Colombia',
  'Chile', 'Argentina', 'Perú', 'Reino Unido', 'India', 'Otro',
];

/**
 * Subtipos de gasto operativo: clasifican gastos administrativos del ERP
 * para proveedores con `categoria = 'GastoOperativo'`.
 */

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


