import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import type { CotizacionRow } from './useCotizacionTypes';

/** Columnas necesarias para la tabla de cotizaciones (evita select('*')) */
const COTIZACION_LIST_COLUMNS = 'id, folio, cliente_id, cliente_nombre, modo, origen, destino, subtotal, moneda, estado, fecha_vigencia, created_at, descripcion_mercancia' as const;

/** Columnas necesarias para el combobox de vincular cotización */
const COTIZACION_ACEPTADA_COLUMNS = 'id, folio, cliente_id, cliente_nombre, modo, tipo, incoterm, descripcion_mercancia, tipo_carga, tipo_contenedor, peso_kg, volumen_m3, piezas, operador, origen, destino, notas' as const;

export function useCotizacionesAceptadas() {
  return useQuery({
    queryKey: [...queryKeys.cotizaciones.all, 'aceptadas'] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotizaciones')
        .select(COTIZACION_ACEPTADA_COLUMNS)
        .eq('estado', 'Aceptada')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CotizacionRow[];
    },
  });
}

export function useCotizaciones() {
  return useQuery({
    queryKey: queryKeys.cotizaciones.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotizaciones')
        .select(COTIZACION_LIST_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CotizacionRow[];
    },
  });
}

export function useCotizacion(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cotizaciones.detail(id!),
    queryFn: async () => {
      if (!id) throw new Error('No id');
      const { data, error } = await supabase
        .from('cotizaciones')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as CotizacionRow;
    },
    enabled: !!id,
  });
}

/** Embarques vinculados a una cotización */
export function useEmbarquesVinculados(cotizacionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cotizaciones.embarquesVinculados(cotizacionId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('embarques')
        .select('id, expediente, estado, created_at')
        .eq('cotizacion_id', cotizacionId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!cotizacionId,
  });
}
