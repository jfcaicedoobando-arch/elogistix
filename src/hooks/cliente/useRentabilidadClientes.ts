import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { calcularUtilidad, calcularMargen } from "@/lib/financial/financialUtils";
import { fetchProfitPorCliente } from "@/services/reportes";

interface FiltrosRentabilidad {
  fechaDesde?: string;
  fechaHasta?: string;
  modo?: string;
}

export interface RentabilidadCliente {
  cliente_id: string;
  cliente_nombre: string;
  total_embarques: number;
  venta_usd: number;
  costo_usd: number;
  profit_usd: number;
  margen: number;
}

export function useRentabilidadClientes(filtros: FiltrosRentabilidad) {
  const { data: raw = [], isLoading } = useQuery({
    queryKey: queryKeys.reportes.rentabilidadClientes(filtros),
    queryFn: () => fetchProfitPorCliente(filtros),
  });

  const clientes: RentabilidadCliente[] = useMemo(
    () =>
      raw.map((r) => {
        const venta = Number(r.venta_usd);
        const costo = Number(r.costo_usd);
        return {
          cliente_id: r.cliente_id,
          cliente_nombre: r.cliente_nombre,
          total_embarques: Number(r.total_embarques),
          venta_usd: venta,
          costo_usd: costo,
          profit_usd: calcularUtilidad(venta, costo),
          margen: calcularMargen(venta, costo),
        };
      }),
    [raw],
  );

  const kpis = useMemo(() => {
    const totalClientes = clientes.length;
    const revenue = clientes.reduce((s, c) => s + c.venta_usd, 0);
    const profit = clientes.reduce((s, c) => s + c.profit_usd, 0);
    const margenProm = revenue > 0 ? ((revenue - clientes.reduce((s, c) => s + c.costo_usd, 0)) / revenue) * 100 : 0;
    return { totalClientes, revenue, profit, margenProm };
  }, [clientes]);

  return { clientes, kpis, isLoading };
}
