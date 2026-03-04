import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CostoCotizacion {
  id: string;
  cotizacion_id: string;
  concepto: string;
  proveedor: string | null;
  moneda: string;
  unidad_medida: string | null;
  costo: number;
  venta: number;
  profit: number | null;
  porcentaje_profit: number | null;
  seccion: string | null;
}

type CostoUpsert = Omit<CostoCotizacion, 'profit' | 'porcentaje_profit'>;

interface SeccionPL {
  totalCosto: number;
  totalVenta: number;
  totalProfit: number;
  porcentajeProfit: number;
}

interface ResultadoPL extends SeccionPL {
  porSeccion: Record<string, SeccionPL>;
}

export function useCotizacionCostos(cotizacionId: string | undefined) {
  return useQuery({
    queryKey: ['cotizacion_costos', cotizacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotizacion_costos')
        .select('*')
        .eq('cotizacion_id', cotizacionId!);
      if (error) throw error;
      return data as CostoCotizacion[];
    },
    enabled: !!cotizacionId,
  });
}

export function useUpsertCostos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (costos: CostoUpsert[]) => {
      const { data, error } = await supabase
        .from('cotizacion_costos')
        .upsert(costos as any)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      const cotizacionId = variables[0]?.cotizacion_id;
      if (cotizacionId) {
        qc.invalidateQueries({ queryKey: ['cotizacion_costos', cotizacionId] });
      }
    },
  });
}

export function useDeleteCosto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cotizacionId }: { id: string; cotizacionId: string }) => {
      const { error } = await supabase
        .from('cotizacion_costos')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { id, cotizacionId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['cotizacion_costos', result.cotizacionId] });
    },
  });
}

function crearSeccionVacia(): SeccionPL {
  return { totalCosto: 0, totalVenta: 0, totalProfit: 0, porcentajeProfit: 0 };
}

export function calcularPL(costos: CostoCotizacion[]): ResultadoPL {
  const secciones = ['Origen', 'Flete Internacional', 'Destino', 'Otro'];
  const porSeccion: Record<string, SeccionPL> = {};
  secciones.forEach(s => { porSeccion[s] = crearSeccionVacia(); });

  let totalCosto = 0, totalVenta = 0;

  for (const c of costos) {
    totalCosto += c.costo;
    totalVenta += c.venta;
    const sec = c.seccion ?? 'Otro';
    const grupo = porSeccion[sec] ?? (porSeccion[sec] = crearSeccionVacia());
    grupo.totalCosto += c.costo;
    grupo.totalVenta += c.venta;
  }

  const totalProfit = totalVenta - totalCosto;
  const porcentajeProfit = totalVenta === 0 ? 0 : Math.round(((totalVenta - totalCosto) / totalVenta) * 10000) / 100;

  for (const s of Object.values(porSeccion)) {
    s.totalProfit = s.totalVenta - s.totalCosto;
    s.porcentajeProfit = s.totalVenta === 0 ? 0 : Math.round(((s.totalVenta - s.totalCosto) / s.totalVenta) * 10000) / 100;
  }

  return { totalCosto, totalVenta, totalProfit, porcentajeProfit, porSeccion };
}
