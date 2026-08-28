/**
 * Tipos y constantes vacíos del payload `dashboard_stats()`.
 */


export interface EmbarqueConEstado {
  id: string;
  expediente: string;
  cliente_nombre: string;
  modo: string;
  tipo: string;
  estado: string;
  estadoReal: string;
  etd: string | null;
  eta: string | null;
  operador: string;
  puerto_origen?: string | null;
  puerto_destino?: string | null;
  aeropuerto_origen?: string | null;
  aeropuerto_destino?: string | null;
  ciudad_origen?: string | null;
  ciudad_destino?: string | null;
  contenedor?: string | null;
  created_at: string;
}

export interface AlertaDemora extends EmbarqueConEstado {
  diasDemora: number;
  diasDesdeEta: number;
  /** Días libres reales aplicados (contenedor → naviera → fallback 7). */
  diasLibres?: number;
  /** `real` = fecha de descarga capturada; `estimada` = se usó la ETA. */
  baseDemora?: "real" | "estimada";
  /** Fecha desde la que se cuentan los días libres (ISO `yyyy-MM-dd`). */
  fechaBaseDemora?: string | null;
}

export interface ProximoArribo extends EmbarqueConEstado {
  diasRestantes: number;
}

export interface EmbarqueConProfit extends EmbarqueConEstado {
  ventaUSD: number;
  costoUSD: number;
  profit: number;
  margen: number;
  ventaMXN: number;
  costoMXN: number;
  profitMXN: number;
  margenMXN: number;
  tipoCambioUSD: number;
  tipoCambioEUR: number;
  ventaMxnFromUsd: number;
  costoMxnFromUsd: number;
  ventaMxnFromEur: number;
  costoMxnFromEur: number;
  ventaMxnNative: number;
  costoMxnNative: number;
}

export interface EmbarqueMesSiguiente extends EmbarqueConProfit {
  facturado: boolean;
}

export interface ResumenFacturacion {
  totalEmbarques: number;
  ventaUSD: number;
  costoUSD: number;
  profitUSD: number;
  ventaMXN: number;
  costoMXN: number;
  profitMXN: number;
  facturados: number;
  nombreMes: string;
}

export interface CargaPorCliente {
  clienteId: string;
  clienteNombre: string;
  total: number;
  desglose: Partial<Record<EstadoFiltro, number>>;
}

export interface ArribosEsteMes {
  total: number;
  yaLlegaron: number;
  enCamino: number;
  profitUSD: number;
  ventaMXN: number;
  costoMXN: number;
  profitMXN: number;
  ventaMxnFromUsd: number;
  costoMxnFromUsd: number;
  ventaMxnFromEur: number;
  costoMxnFromEur: number;
  ventaMxnNative: number;
  costoMxnNative: number;
  gastosOperativosMXN: number;
}

// v13.303.41 — `En Proceso` (estado lateral del grafo) sale del filtro
// visual del dashboard. Sigue vivo en BD y en `ESTADOS_ACTIVOS` para
// otros módulos (Operaciones); simplemente no se cuenta en la timeline
// del dashboard hasta que el embarque avance a Arribo.
export const ESTADOS_FILTRO = [
  "Confirmado", "En Tránsito", "Arribo", "En Aduana", "Entregado", "EIR",
  "Por liquidar",
] as const;
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];

// v13.303.22 — `Llegada` deprecado (fuera del workflow) además de `Cotización`.
export const EMPTY_CONTEO: Record<EstadoFiltro, number> = {
  Confirmado: 0,
  "En Tránsito": 0,
  Arribo: 0,
  "En Aduana": 0,
  Entregado: 0,
  EIR: 0,
  "Por liquidar": 0,
};

export const EMPTY_ARRIBOS: ArribosEsteMes = {
  total: 0,
  yaLlegaron: 0,
  enCamino: 0,
  profitUSD: 0,
  ventaMXN: 0,
  costoMXN: 0,
  profitMXN: 0,
  ventaMxnFromUsd: 0,
  costoMxnFromUsd: 0,
  ventaMxnFromEur: 0,
  costoMxnFromEur: 0,
  ventaMxnNative: 0,
  costoMxnNative: 0,
  gastosOperativosMXN: 0,
};

export const EMPTY_RESUMEN: ResumenFacturacion = {
  totalEmbarques: 0,
  ventaUSD: 0,
  costoUSD: 0,
  profitUSD: 0,
  ventaMXN: 0,
  costoMXN: 0,
  profitMXN: 0,
  facturados: 0,
  nombreMes: "",
};

export type DashboardStats = Record<string, unknown> | null | undefined;
