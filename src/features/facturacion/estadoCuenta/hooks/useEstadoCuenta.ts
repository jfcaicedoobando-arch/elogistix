import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchEstadoCuenta,
  fetchEstadoCuentaKpis,
  type EstadoCuentaFilters,
  type FacturaEstadoCuenta,
} from "../services/estadoCuenta";
import {
  calcularKpisEstadoCuenta,
  type KpisEstadoCuenta,
} from "../services/estadoCuentaAggregates";
import { estadoCuenta as estadoCuentaKeys } from "@/features/facturacion/queryKeys";

/**
 * FIX C3c: la RPC `estado_cuenta_agregados` aplica cliente + rango de fechas.
 * Si además hay filtro de moneda o "sólo con saldo", el universo remoto deja de
 * coincidir con la tabla y se agrega en cliente sobre las filas cargadas.
 */
function puedeAgregarEnServidor(f: EstadoCuentaFilters): boolean {
  const sinMoneda = !f.moneda || f.moneda === "todas";
  return sinMoneda && !f.soloConSaldo;
}

export function useEstadoCuenta(filters: EstadoCuentaFilters) {
  const query = useQuery({
    queryKey: estadoCuentaKeys.list(filters),
    queryFn: () => fetchEstadoCuenta(filters),
    enabled: filters.clienteIds.length > 0,
    staleTime: 30_000,
  });

  const remotoHabilitado = puedeAgregarEnServidor(filters) && filters.clienteIds.length > 0;
  const kpisQuery = useQuery({
    queryKey: [...estadoCuentaKeys.list(filters), "kpis"],
    queryFn: () => fetchEstadoCuentaKpis(filters),
    enabled: remotoHabilitado,
    staleTime: 30_000,
  });

  const rows: FacturaEstadoCuenta[] = useMemo(() => query.data ?? [], [query.data]);
  const kpisLocales = useMemo(() => calcularKpisEstadoCuenta(rows), [rows]);

  const kpis: KpisEstadoCuenta = useMemo(() => {
    const r = kpisQuery.data;
    if (!remotoHabilitado || !r) return kpisLocales;
    return {
      adeudado: { mxn: r.adeudado_mxn, usd: r.adeudado_usd },
      vencido: { mxn: r.vencido_mxn, usd: r.vencido_usd },
      aFavor: { mxn: r.a_favor_mxn, usd: r.a_favor_usd },
      facturasVencidas: r.facturas_vencidas,
      facturasAdeudadas: r.facturas_adeudadas,
    };
  }, [remotoHabilitado, kpisQuery.data, kpisLocales]);

  return { ...query, rows, kpis, kpisIsLoading: remotoHabilitado && kpisQuery.isLoading };
}
