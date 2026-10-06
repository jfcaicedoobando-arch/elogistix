/** Shape del jsonb de `estado_cuenta_agregados` (C3c). */
export interface KpisEstadoCuentaRemotos {
  adeudado_mxn: number;
  adeudado_usd: number;
  adeudado_eur: number;
  vencido_mxn: number;
  vencido_usd: number;
  vencido_eur: number;
  a_favor_mxn: number;
  a_favor_usd: number;
  a_favor_eur: number;
  facturas_vencidas: number;
  facturas_adeudadas: number;
}

export const KPIS_ESTADO_CUENTA_VACIOS: KpisEstadoCuentaRemotos = {
  adeudado_mxn: 0, adeudado_usd: 0, adeudado_eur: 0,
  vencido_mxn: 0, vencido_usd: 0, vencido_eur: 0,
  a_favor_mxn: 0, a_favor_usd: 0, a_favor_eur: 0,
  facturas_vencidas: 0, facturas_adeudadas: 0,
};

