export interface DemoraContenedor {
  contenedor_id: string;
  numero_contenedor: string;
  tipo_contenedor: string;
  monto_costo_usd: number;
  monto_venta_usd: number;
}

export interface DemoraDesglose {
  embarque_id: string;
  sin_eventos: boolean;
  fecha_descarga: string | null;
  fecha_devolucion: string | null;
  dias_en_puerto: number;
  dias_libres: number;
  dias_excedidos: number;
  total_costo_usd: number;
  /** Moneda del costo de la naviera (tabulador). Default 'USD'. */
  moneda_costo?: string;
  total_venta_usd: number;

  contenedores: DemoraContenedor[];
  error?: string;
}
