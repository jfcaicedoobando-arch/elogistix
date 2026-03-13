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

export const getEstadoColor = (estado: string): string => {
  const colors: Record<string, string> = {
    'Confirmado': 'bg-info/15 text-info border border-info/30',
    'En Tránsito': 'bg-warning/15 text-warning border border-warning/30',
    'Arribo': 'bg-cyan-500/15 text-cyan-600 border border-cyan-500/30',
    'En Aduana': 'bg-violet-500/15 text-violet-600 border border-violet-500/30',
    'Entregado': 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30',
    'EIR': 'bg-orange-500/15 text-orange-600 border border-orange-500/30',
    'Cerrado': 'bg-muted text-muted-foreground border border-border',
    'Cancelado': 'bg-destructive/15 text-destructive border border-destructive/30',
    // Estados de facturación
    'Borrador': 'bg-muted text-muted-foreground border border-border',
    'Emitida': 'bg-info/15 text-info border border-info/30',
    'Pagada': 'bg-success/15 text-success border border-success/30',
    'Vencida': 'bg-destructive/15 text-destructive border border-destructive/30',
    'Cancelada': 'bg-destructive/15 text-destructive border border-destructive/30',
    'Pendiente': 'bg-warning/15 text-warning border border-warning/30',
    'Recibido': 'bg-info/15 text-info border border-info/30',
    'Validado': 'bg-success/15 text-success border border-success/30',
    'Pagado': 'bg-success/15 text-success border border-success/30',
    // Estados de cotización
    'Enviada': 'bg-info/15 text-info border border-info/30',
    'Aceptada': 'bg-warning/15 text-warning border border-warning/30',
    'Confirmada': 'bg-success/15 text-success border border-success/30',
    'Rechazada': 'bg-destructive/15 text-destructive border border-destructive/30',
    'Embarcada': 'bg-indigo-500/15 text-indigo-600 border border-indigo-500/30',
  };
  return colors[estado] || 'bg-muted text-muted-foreground border border-border';
};

export const resolverContacto = (
  contactos: Array<{ id: string; nombre: string; tipo: string; pais: string }>,
  valor: string,
  valorManual: string
): string => {
  if (valor === '__otro__') return valorManual.trim();
  const contacto = contactos.find(c => c.id === valor);
  return contacto ? `${contacto.nombre} — ${contacto.tipo} (${contacto.pais})` : valor;
};

export const getModoIcon = (modo: string): string => {
  const icons: Record<string, string> = {
    'Marítimo': '🚢',
    'Aéreo': '✈️',
    'Terrestre': '🚛',
    'Multimodal': '🔄',
  };
  return icons[modo] || '📦';
};
