import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/queryKeys';
import type { CotizacionRow, CreateCotizacionInput } from './useCotizacionTypes';

type CotizacionInsert = TablesInsert<'cotizaciones'>;
type CotizacionUpdate = Partial<CotizacionInsert>;

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

export function useCreateCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCotizacionInput) => {
      const folio = await generarFolio();
      const fechaVigencia = new Date();
      fechaVigencia.setDate(fechaVigencia.getDate() + input.vigencia_dias);

      const insertPayload: CotizacionInsert = {
        folio,
        cliente_id: input.es_prospecto ? null : input.cliente_id,
        cliente_nombre: input.cliente_nombre,
        es_prospecto: input.es_prospecto,
        prospecto_empresa: input.prospecto_empresa || '',
        prospecto_contacto: input.prospecto_contacto || '',
        prospecto_email: input.prospecto_email || '',
        prospecto_telefono: input.prospecto_telefono || '',
        modo: input.modo as CotizacionInsert['modo'],
        tipo: input.tipo as CotizacionInsert['tipo'],
        incoterm: input.incoterm as CotizacionInsert['incoterm'],
        descripcion_mercancia: input.descripcion_mercancia,
        peso_kg: input.peso_kg,
        volumen_m3: input.volumen_m3,
        piezas: input.piezas,
        origen: input.origen,
        destino: input.destino,
        conceptos_venta: input.conceptos_venta as unknown as Json,
        subtotal: input.subtotal,
        moneda: input.moneda as CotizacionInsert['moneda'],
        vigencia_dias: input.vigencia_dias,
        fecha_vigencia: fechaVigencia.toISOString().split('T')[0],
        notas: input.notas || null,
        operador: input.operador,
        tipo_carga: input.tipo_carga || 'Carga General',
        msds_archivo: input.msds_archivo || null,
        tipo_embarque: input.tipo_embarque || 'FCL',
        tipo_contenedor: input.tipo_contenedor || null,
        tipo_peso: input.tipo_peso || 'Peso Normal',
        descripcion_adicional: input.descripcion_adicional || '',
        sector_economico: input.sector_economico || '',
        dimensiones_lcl: (input.dimensiones_lcl || []) as unknown as Json,
        dimensiones_aereas: (input.dimensiones_aereas || []) as unknown as Json,
        dias_libres_destino: input.dias_libres_destino ?? 0,
        dias_almacenaje: input.dias_almacenaje ?? 0,
        tiempo_transito_dias: input.tiempo_transito_dias ?? null,
        frecuencia: input.frecuencia || '',
        ruta_texto: input.ruta_texto || '',
        validez_propuesta: input.validez_propuesta ?? null,
        tipo_movimiento: input.tipo_movimiento || '',
        seguro: input.seguro ?? false,
        valor_seguro_usd: input.valor_seguro_usd ?? 0,
        carta_garantia: input.carta_garantia ?? false,
        num_contenedores: input.num_contenedores ?? 1,
      };

      const { data, error } = await supabase
        .from('cotizaciones')
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CotizacionRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}

export function useUpdateCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateCotizacionInput> }) => {
      const updatePayload = { ...data } as unknown as CotizacionUpdate;
      if (data.conceptos_venta) updatePayload.conceptos_venta = data.conceptos_venta as unknown as Json;
      if (data.dimensiones_lcl) updatePayload.dimensiones_lcl = data.dimensiones_lcl as unknown as Json;
      if (data.dimensiones_aereas) updatePayload.dimensiones_aereas = data.dimensiones_aereas as unknown as Json;
      if (data.modo) updatePayload.modo = data.modo as CotizacionInsert['modo'];
      if (data.tipo) updatePayload.tipo = data.tipo as CotizacionInsert['tipo'];
      if (data.incoterm) updatePayload.incoterm = data.incoterm as CotizacionInsert['incoterm'];
      if (data.moneda) updatePayload.moneda = data.moneda as CotizacionInsert['moneda'];
      const { error } = await supabase.from('cotizaciones').update(updatePayload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.id) });
    },
  });
}

export function useDeleteCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cotizaciones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}

export function useUpdateEstadoCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const { error } = await supabase
        .from('cotizaciones')
        .update({ estado: estado as CotizacionInsert['estado'] })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.id) });
    },
  });
}
