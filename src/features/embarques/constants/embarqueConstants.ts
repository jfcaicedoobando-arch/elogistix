export function getDocsForMode(modo: string): string[] {
  if (modo === 'Marítimo' || !modo) {
    return ['Bill of Lading (BL Master)', 'Bill of Lading (BL House)', 'Packing List', 'Factura Comercial', 'Certificado de Origen', 'Ficha Técnica', 'Otros'];
  }
  if (modo === 'Aéreo') {
    return ['Air Waybill (AWB)', 'Packing List', 'Factura Comercial'];
  }
  return ['Carta Porte', 'Factura', 'Lista de Empaque'];
}

export const ESTADOS_EMBARQUE = ['Borrador', 'Confirmado', 'En Tránsito', 'Arribo', 'En Aduana', 'Entregado', 'EIR', 'Cerrado'] as const;

export const ESTADOS_ACTIVOS = ['Confirmado', 'En Tránsito', 'Arribo', 'En Aduana', 'Entregado'] as const;



export const MODOS_TRANSPORTE = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'] as const;

export const ICONO_EVENTO: Record<string, string> = {
  Zarpe: '🚢', Transbordo: '🔄', 'Arribo a Puerto': '⚓', Descarga: '📦',
  'Despacho Aduanal': '🛃', Liberación: '✅', 'En Ruta Terrestre': '🚛',
  Entrega: '🏁', Demora: '⚠️', Inspección: '🔍', Otro: '📝',
  'Cambio de ETA': '📅',
};

