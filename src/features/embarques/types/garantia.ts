export type EstadoGarantia = 'pendiente' | 'depositado' | 'liberado' | 'retenido';

export interface GarantiaContenedor {
  id: string;
  embarque_id: string;
  embarque_contenedor_id: string;
  naviera_id: string | null;
  monto_deposito_usd: number;
  tiene_carta_garantia: boolean;
  estado: EstadoGarantia;
  fecha_deposito: string | null;
  fecha_liberacion: string | null;
  fecha_limite_devolucion: string | null;
  referencia_deposito: string | null;
  notas: string | null;
}

export const ESTADO_GARANTIA_LABEL: Record<EstadoGarantia, string> = {
  pendiente: 'Pendiente',
  depositado: 'Depositado',
  liberado: 'Liberado',
  retenido: 'Retenido',
};

const ESTADO_GARANTIA_COLOR: Record<EstadoGarantia, string> = {
  pendiente: 'bg-warning/15 text-warning border-warning/30',
  depositado: 'bg-info/15 text-info border-info/30',
  liberado: 'bg-success/15 text-success border-success/30',
  retenido: 'bg-destructive/15 text-destructive border-destructive/30',
};
void ESTADO_GARANTIA_COLOR;
