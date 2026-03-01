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
    'Cotización': 'bg-muted text-muted-foreground',
    'Confirmado': 'bg-info/15 text-info',
    'En Tránsito': 'bg-warning/15 text-warning',
    'Llegada': 'bg-accent/15 text-accent',
    'En Proceso': 'bg-info/15 text-info',
    'Cerrado': 'bg-success/15 text-success',
    'Borrador': 'bg-muted text-muted-foreground',
    'Emitida': 'bg-info/15 text-info',
    'Pagada': 'bg-success/15 text-success',
    'Vencida': 'bg-destructive/15 text-destructive',
    'Cancelada': 'bg-destructive/15 text-destructive',
    'Pendiente': 'bg-warning/15 text-warning',
    'Recibido': 'bg-info/15 text-info',
    'Validado': 'bg-success/15 text-success',
    'Pagado': 'bg-success/15 text-success',
  };
  return colors[estado] || 'bg-muted text-muted-foreground';
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
