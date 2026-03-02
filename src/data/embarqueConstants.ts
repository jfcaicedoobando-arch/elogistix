export function getDocsForMode(modo: string): string[] {
  if (modo === 'Marítimo' || !modo) {
    return ['Bill of Lading (BL Master)', 'Bill of Lading (BL House)', 'Packing List', 'Factura Comercial', 'Certificado de Origen', 'Ficha Técnica', 'Otros'];
  }
  if (modo === 'Aéreo') {
    return ['Air Waybill (AWB)', 'Packing List', 'Factura Comercial'];
  }
  return ['Carta Porte', 'Factura', 'Lista de Empaque'];
}

export const ESTADO_TIMELINE = ['Cotización', 'Confirmado', 'En Tránsito', 'Llegada', 'En Proceso', 'Cerrado'] as const;

export const CONCEPTOS_EMBARQUE = ['Flete Marítimo', 'Embalaje', 'Coordinación de Recolección', 'Seguro de Carga', 'Manejo', 'Demoras'];

/** @deprecated Usar CONCEPTOS_EMBARQUE */
export const CONCEPTOS_MARITIMOS = CONCEPTOS_EMBARQUE;
