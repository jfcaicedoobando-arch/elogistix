/** Fila de hueco de facturación para consultas y exportación pura. */
export interface FilaHueco {
  embarque_id: string;
  expediente: string;
  cliente_nombre: string;
  operador: string;
  etd: string | null;
  eta: string;
  bl_master: string | null;
  bl_house: string | null;
  diasDesdeEta: number;
  ventaMxn: number;
  ventaUsd: number;
  /** Ola 9 · M5: el embarque no tiene TC capturado; las conversiones valen 0. */
  sin_tc: boolean;
}
