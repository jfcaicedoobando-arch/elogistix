// Shared helper functions extracted from mockData.ts

import { format, parseISO } from "date-fns";

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
};

// Re-export UI mappings for backward compatibility
export { getEstadoColor, getModoIcon } from "@/lib/uiMappings";

export const resolverContacto = (
  contactos: Array<{ id: string; nombre: string; tipo: string; pais: string }>,
  valor: string,
  valorManual: string
): string => {
  if (valor === '__otro__') return valorManual.trim();
  const contacto = contactos.find(c => c.id === valor);
  return contacto ? `${contacto.nombre} — ${contacto.tipo} (${contacto.pais})` : valor;
};
