import type { TipoProveedor, Moneda } from "@/data/types";

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
