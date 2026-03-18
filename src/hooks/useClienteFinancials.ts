import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useClienteFinancials(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['cliente-financials', clienteId],
    queryFn: async () => {
      // Facturas del cliente
      const { data: facturas, error: errF } = await supabase
        .from('facturas')
        .select('total, moneda, estado, embarque_id')
        .eq('cliente_id', clienteId!);
      if (errF) throw errF;

      let facturadoUSD = 0;
      let pendienteUSD = 0;
      (facturas ?? []).forEach((f) => {
        const monto = f.total ?? 0;
        facturadoUSD += monto;
        if (f.estado === 'Emitida' || f.estado === 'Vencida') {
          pendienteUSD += monto;
        }
      });

      // Profit: venta - costo de embarques del cliente
      const { data: profitData, error: errP } = await supabase.rpc('profit_por_cliente', {
        _fecha_desde: undefined,
        _fecha_hasta: undefined,
        _modo: undefined,
      });
      if (errP) throw errP;

      const clienteProfit = (profitData ?? []).find((r: any) => r.cliente_id === clienteId);
      const ventaUSD = clienteProfit?.venta_usd ?? 0;
      const costoUSD = clienteProfit?.costo_usd ?? 0;
      const profitUSD = ventaUSD - costoUSD;

      return { facturadoUSD, pendienteUSD, profitUSD };
    },
    enabled: !!clienteId,
  });
}
