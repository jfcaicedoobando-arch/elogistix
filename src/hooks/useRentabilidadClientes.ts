import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { calcularUtilidad, calcularMargen } from "@/lib/financialUtils";
import { useMemo } from "react";

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
    queryFn: async () => {
      const { data, error } = await supabase.rpc("profit_por_cliente", {
        _fecha_desde: filtros.fechaDesde || null,
        _fecha_hasta: filtros.fechaHasta || null,
        _modo: filtros.modo || null,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientes: RentabilidadCliente[] = useMemo(
    () =>
      raw.map((r: { cliente_id: string; cliente_nombre: string; total_embarques: number; venta_usd: number; costo_usd: number }) => {
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
