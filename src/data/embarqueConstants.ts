export function getDocsForMode(modo: string): string[] {
  if (modo === 'Marítimo' || !modo) {
    return ['Bill of Lading (BL Master)', 'Bill of Lading (BL House)', 'Packing List', 'Factura Comercial', 'Certificado de Origen', 'Ficha Técnica', 'Otros'];
  }
  if (modo === 'Aéreo') {
    return ['Air Waybill (AWB)', 'Packing List', 'Factura Comercial'];
  }
  return ['Carta Porte', 'Factura', 'Lista de Empaque'];
}

export const ESTADO_TIMELINE = ['Confirmado', 'En Tránsito', 'Arribo', 'En Aduana', 'Entregado', 'EIR', 'Cerrado'] as const;

export const ESTADOS_EMBARQUE = ['Confirmado', 'En Tránsito', 'Arribo', 'En Aduana', 'Entregado', 'EIR', 'Cerrado'] as const;

export const ESTADOS_ACTIVOS = ['Confirmado', 'En Tránsito', 'Arribo', 'En Aduana', 'Entregado'] as const;

export const ESTADOS_INACTIVOS = ['EIR', 'Cerrado'] as const;

export const MODOS_TRANSPORTE = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'] as const;

export const CATALOGO_CONCEPTOS = [
  'Cargos en Origen',
  'Costos Portuarios',
  'Consolidación',
  'Seguro',
  'Recolección',
  'Modificación de BL',
  'Flete Marítimo',
  'Flete Aéreo',
  'Flete Terrestre',
  'Handling',
  'Desconsolidación',
  'Revalidación',
  'Demoras',
  'Cargos en Destino',
  'Release',
  'Honorarios de Despacho Aduanal',
  'Entrega Nacional',
  'Otro'
] as const;
