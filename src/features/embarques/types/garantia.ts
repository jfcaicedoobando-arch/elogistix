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
