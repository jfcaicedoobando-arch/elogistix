// Shared helper functions extracted from mockData.ts

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const [anio, mes, dia] = parts;
  return `${dia}/${mes}/${anio}`;
};

export const getEstadoColor = (estado: string): string => {
  const colors: Record<string, string> = {
    'Confirmado': 'bg-info/15 text-info',
    'En Tránsito': 'bg-warning/15 text-warning',
    'Arribo': 'bg-cyan-500/15 text-cyan-600',
    'En Aduana': 'bg-violet-500/15 text-violet-600',
    'Entregado': 'bg-emerald-500/15 text-emerald-600',
    'EIR': 'bg-orange-500/15 text-orange-600',
    'Cerrado': 'bg-muted text-muted-foreground',
    'Cancelado': 'bg-destructive/15 text-destructive',
    // Estados de facturación
    'Borrador': 'bg-muted text-muted-foreground',
    'Emitida': 'bg-info/15 text-info',
    'Pagada': 'bg-success/15 text-success',
    'Vencida': 'bg-destructive/15 text-destructive',
    'Cancelada': 'bg-destructive/15 text-destructive',
    'Pendiente': 'bg-warning/15 text-warning',
    'Recibido': 'bg-info/15 text-info',
    'Validado': 'bg-success/15 text-success',
    'Pagado': 'bg-success/15 text-success',
    // Estados de cotización
    'Enviada': 'bg-info/15 text-info',
    'Aceptada': 'bg-warning/15 text-warning',
    'Confirmada': 'bg-success/15 text-success',
    'Rechazada': 'bg-destructive/15 text-destructive',
    'Embarcada': 'bg-indigo-500/15 text-indigo-600',
  };
  return colors[estado] || 'bg-muted text-muted-foreground';
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
