export function getDocsForMode(modo: string): string[] {
  if (modo === 'Marítimo' || !modo) {
    return ['Bill of Lading (BL Master)', 'Bill of Lading (BL House)', 'Packing List', 'Factura Comercial', 'Certificado de Origen', 'Ficha Técnica', 'Otros'];
  }
  if (modo === 'Aéreo') {
    return ['Air Waybill (AWB)', 'Packing List', 'Factura Comercial'];
  }
  return ['Carta Porte', 'Factura', 'Lista de Empaque'];
}

export const ESTADO_TIMELINE = ['Confirmado', 'En Tránsito', 'En Aduana', 'Llegada', 'En Proceso', 'Entregado', 'Cerrado'] as const;

export const CATALOGO_CONCEPTOS = [
  'Flete Marítimo',
  'Embalaje',
  'Coordinación de Recolección',
  'Seguro de Carga',
  'Manejo',
  'Demoras',
  'Cargos en Destino',
  'Cargos en Origen',
] as const;
