/**
 * Tipos compartidos del Dashboard Dirección.
 */
export interface HeroKpis {
  utilidad_mxn: number;
  venta_mxn: number;
  costo_mxn: number;
  margen_pct: number;
  margen_pct_prev: number;
  cartera_vencida_mxn: number;
  cartera_vencida_clientes: number;
  facturado_mes_mxn: number;
}

export interface MargenMes {
  mes: string; // YYYY-MM
  margen_pct: number;
  utilidad_mxn: number;
}

export interface MargenModo {
  modo: string;
  margen_pct: number;
  venta_mxn: number;
}

export interface BucketAntiguedad {
  bucket: "Corriente" | "1-30" | "31-60" | "+60";
  monto_mxn: number;
  facturas: number;
}

export interface TopCliente {
  cliente_id: string | null;
  cliente_nombre: string;
  utilidad_mxn: number;
  pct: number;
}

export interface PulsoKpis {
  embarques_activos: number;
  embarques_por_estado: Array<{ estado: string; total: number }>;
  arribos_7d: number;
  demoras: number;
  documentos_vencidos: number | null; // null = placeholder "sin datos"
  cfdi_timbrados_mes: number;
  acuses_pendientes: number;
}

export interface DireccionKpis {
  hero: HeroKpis;
  margen_6m: MargenMes[];
  margen_por_modo: MargenModo[];
  antiguedad: BucketAntiguedad[];
  top_clientes: TopCliente[];
  pulso: PulsoKpis;
}
