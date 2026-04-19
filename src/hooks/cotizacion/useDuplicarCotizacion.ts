import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/queryKeys';

type CotizacionInsert = TablesInsert<'cotizaciones'>;

async function generarFolio(): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `COT-${anio}-`;
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('folio')
    .like('folio', `${prefijo}%`)
    .order('folio', { ascending: false })
    .limit(1);
  if (error) throw error;
  let siguiente = 1;
  if (data && data.length > 0) {
    const numero = parseInt(data[0].folio.replace(prefijo, ''), 10);
    if (!isNaN(numero)) siguiente = numero + 1;
  }
  return `${prefijo}${String(siguiente).padStart(4, '0')}`;
}

export function useDuplicarCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cotizacionId: string) => {
      // Fetch original
      const { data: orig, error: errOrig } = await supabase
        .from('cotizaciones')
        .select('*')
        .eq('id', cotizacionId)
        .single();
      if (errOrig) throw errOrig;

      const folio = await generarFolio();
      const fechaVigencia = new Date();
      fechaVigencia.setDate(fechaVigencia.getDate() + (orig.vigencia_dias ?? 15));

      const {
        id: _id, created_at: _ca, updated_at: _ua, folio: _f,
        estado: _e, embarque_id: _eid, fecha_vigencia: _fv,
        ...rest
      } = orig;

      const payload: CotizacionInsert = {
        ...rest,
        folio,
        estado: 'Borrador',
        embarque_id: null,
        fecha_vigencia: fechaVigencia.toISOString().split('T')[0],
        conceptos_venta: rest.conceptos_venta as Json,
        dimensiones_lcl: rest.dimensiones_lcl as Json,
        dimensiones_aereas: rest.dimensiones_aereas as Json,
      } as CotizacionInsert;

      const { data, error } = await supabase
        .from('cotizaciones')
        .insert(payload)
        .select('id, folio')
        .single();
      if (error) throw error;

      // Duplicate costos if any
      const { data: costos } = await supabase
        .from('cotizacion_costos')
        .select('*')
        .eq('cotizacion_id', cotizacionId);
      if (costos && costos.length > 0) {
        const nuevos = costos.map(({ id: _cid, created_at: _cca, updated_at: _cua, cotizacion_id: _ccid, ...c }) => ({
          ...c,
          cotizacion_id: data.id,
        }));
        await supabase.from('cotizacion_costos').insert(nuevos);
      }

      return data as { id: string; folio: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}
