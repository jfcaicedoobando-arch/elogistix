import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json, Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/queryKeys';
import type { CotizacionRow } from './useCotizacionTypes';

type CotizacionInsert = TablesInsert<'cotizaciones'>;
type EmbarqueInsert = TablesInsert<'embarques'>;

/** Convierte un prospecto en cliente y actualiza la cotización */
export function useConvertirProspectoACliente() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cotizacionId,
      clienteData,
    }: {
      cotizacionId: string;
      clienteData: {
        nombre: string;
        contacto: string;
        email: string;
        telefono: string;
        rfc?: string;
        direccion?: string;
        ciudad?: string;
        estado?: string;
        cp?: string;
      };
    }) => {
      const { data: clienteCreado, error: errorCliente } = await supabase
        .from('clientes')
        .insert({
          nombre: clienteData.nombre,
          contacto: clienteData.contacto,
          email: clienteData.email,
          telefono: clienteData.telefono,
          rfc: clienteData.rfc || '',
          direccion: clienteData.direccion || '',
          ciudad: clienteData.ciudad || '',
          estado: clienteData.estado || '',
          cp: clienteData.cp || '',
        })
        .select()
        .single();
      if (errorCliente) throw errorCliente;

      const { error: errorUpdate } = await supabase
        .from('cotizaciones')
        .update({
          cliente_id: clienteCreado.id,
          cliente_nombre: clienteCreado.nombre,
          es_prospecto: false,
        })
        .eq('id', cotizacionId);
      if (errorUpdate) throw errorUpdate;

      if (user) {
        await supabase.from('bitacora_actividad').insert({
          usuario_id: user.id,
          usuario_email: user.email ?? '',
          accion: 'Convertir prospecto a cliente',
          modulo: 'Cotizaciones',
          entidad_id: cotizacionId,
          entidad_nombre: clienteCreado.nombre,
          detalles: { cliente_id: clienteCreado.id } as unknown as Json,
        });
      }

      return clienteCreado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
    },
  });
}

/** Convierte una cotización en uno o más embarques según num_contenedores */
export function useConvertirCotizacionAEmbarques() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cotizacion: CotizacionRow) => {
      // 1. Leer costos de la cotización
      const { data: costos, error: errorCostos } = await supabase
        .from('cotizacion_costos')
        .select('*')
        .eq('cotizacion_id', cotizacion.id);
      if (errorCostos) throw errorCostos;

      const numContenedores = cotizacion.num_contenedores ?? 1;
      const embarquesCreados: Tables<'embarques'>[] = [];

      // 2. Loop por cada contenedor
      for (let i = 0; i < numContenedores; i++) {
        // a. Generar expediente único
        const { data: expediente, error: errorExp } = await supabase
          .rpc('generar_expediente', { tipo_op: cotizacion.tipo });
        if (errorExp) throw errorExp;

        // b. Insertar embarque
        const embarqueInsert: EmbarqueInsert = {
          cotizacion_id: cotizacion.id,
          expediente: expediente as string,
          cliente_id: cotizacion.cliente_id!,
          cliente_nombre: cotizacion.cliente_nombre,
          estado: 'Confirmado',
          modo: cotizacion.modo,
          tipo: cotizacion.tipo,
          incoterm: cotizacion.incoterm,
          descripcion_mercancia: cotizacion.descripcion_mercancia,
          peso_kg: cotizacion.peso_kg,
          volumen_m3: cotizacion.volumen_m3,
          piezas: cotizacion.piezas,
          operador: cotizacion.operador,
          tipo_carga: cotizacion.tipo_carga,
          tipo_contenedor: cotizacion.tipo_contenedor,
        };

        const { data: embarque, error: errorEmb } = await supabase
          .from('embarques')
          .insert(embarqueInsert)
          .select()
          .single();
        if (errorEmb) throw errorEmb;

        // c. Insertar conceptos de costo según unidad_medida
        if (costos && costos.length > 0) {
          const conceptosParaInsertar = costos.filter((c) => {
            const um = c.unidad_medida ?? 'Contenedor';
            if (um === 'BL') return i === 0;
            return true;
          });

          if (conceptosParaInsertar.length > 0) {
            const rows: TablesInsert<'conceptos_costo'>[] = conceptosParaInsertar.map((c) => ({
              embarque_id: embarque.id,
              concepto: c.concepto,
              monto: c.costo_unitario,
              moneda: c.moneda as TablesInsert<'conceptos_costo'>['moneda'],
              proveedor_nombre: c.proveedor,
            }));

            const { error: errorConceptos } = await supabase
              .from('conceptos_costo')
              .insert(rows);
            if (errorConceptos) throw errorConceptos;
          }
        }

        embarquesCreados.push(embarque);
      }

      // 3. Actualizar estado de la cotización
      const { error: errorUpdate } = await supabase
        .from('cotizaciones')
        .update({ estado: 'Embarcada' as CotizacionInsert['estado'] })
        .eq('id', cotizacion.id);
      if (errorUpdate) throw errorUpdate;

      // 4. Retornar embarques creados
      return embarquesCreados;
    },
    onSuccess: (_data, cotizacion) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(cotizacion.id) });
    },
  });
}
