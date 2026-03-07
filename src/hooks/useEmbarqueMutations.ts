import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import type { EmbarqueRow } from './useEmbarqueUtils';

// ─── Create ──────────────────────────────────────────────
interface CreateEmbarqueInput {
  embarque: TablesInsert<'embarques'>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
  documentos: Omit<TablesInsert<'documentos_embarque'>, 'embarque_id'>[];
}

export function useCreateEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarque, conceptosVenta, conceptosCosto, documentos }: CreateEmbarqueInput) => {
      const { data: embarqueCreado, error: errorCrearEmbarque } = await supabase
        .from('embarques')
        .insert(embarque)
        .select()
        .single();
      if (errorCrearEmbarque) throw errorCrearEmbarque;

      const embarqueId = embarqueCreado.id;
      const promises: PromiseLike<any>[] = [];

      if (conceptosVenta.length > 0) {
        promises.push(
          supabase.from('conceptos_venta').insert(
            conceptosVenta.map(cv => ({ ...cv, embarque_id: embarqueId }))
          ).select().then(r => r)
        );
      }
      if (conceptosCosto.length > 0) {
        promises.push(
          supabase.from('conceptos_costo').insert(
            conceptosCosto.map(cc => ({ ...cc, embarque_id: embarqueId }))
          ).select().then(r => r)
        );
      }
      if (documentos.length > 0) {
        promises.push(
          supabase.from('documentos_embarque').insert(
            documentos.map(d => ({ ...d, embarque_id: embarqueId }))
          ).select().then(r => r)
        );
      }

      promises.push(
        supabase.from('notas_embarque').insert({
          embarque_id: embarqueId,
          contenido: 'Embarque creado',
          tipo: 'sistema' as const,
        }).select().then(r => r)
      );

      const results = await Promise.all(promises);
      for (const r of results) {
        if (r.error) throw r.error;
      }

      return embarqueCreado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
    },
  });
}

// ─── Update ──────────────────────────────────────────────
interface UpdateEmbarqueInput {
  id: string;
  embarque: Partial<TablesInsert<'embarques'>>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
}

export function useUpdateEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, embarque, conceptosVenta, conceptosCosto }: UpdateEmbarqueInput) => {
      const { data: embarqueActualizado, error: errorActualizar } = await supabase
        .from('embarques')
        .update(embarque)
        .eq('id', id)
        .select()
        .single();
      if (errorActualizar) throw errorActualizar;

      const { error: errorBorrarVenta } = await supabase.from('conceptos_venta').delete().eq('embarque_id', id);
      if (errorBorrarVenta) throw errorBorrarVenta;

      const { error: errorBorrarCosto } = await supabase.from('conceptos_costo').delete().eq('embarque_id', id);
      if (errorBorrarCosto) throw errorBorrarCosto;

      if (conceptosVenta.length > 0) {
        const { error } = await supabase.from('conceptos_venta').insert(
          conceptosVenta.map(cv => ({ ...cv, embarque_id: id }))
        );
        if (error) throw error;
      }

      if (conceptosCosto.length > 0) {
        const { error } = await supabase.from('conceptos_costo').insert(
          conceptosCosto.map(cc => ({ ...cc, embarque_id: id }))
        );
        if (error) throw error;
      }

      return embarqueActualizado;
    },
    onSuccess: (embarqueActualizado) => {
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
      queryClient.invalidateQueries({ queryKey: ['embarques', embarqueActualizado.id] });
      queryClient.invalidateQueries({ queryKey: ['conceptos_venta', embarqueActualizado.id] });
      queryClient.invalidateQueries({ queryKey: ['conceptos_costo', embarqueActualizado.id] });
    },
  });
}

// ─── Duplicar ────────────────────────────────────────────
interface DuplicarEmbarqueInput {
  embarqueOrigen: EmbarqueRow;
  copias: Array<{
    num_contenedor: string;
    tipo_contenedor: string;
    peso_kg: number;
    volumen_m3: number;
    piezas: number;
  }>;
}

export function useDuplicarEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueOrigen, copias }: DuplicarEmbarqueInput) => {
      const [{ data: ventaOrigen }, { data: costoOrigen }] = await Promise.all([
        supabase.from('conceptos_venta').select('*').eq('embarque_id', embarqueOrigen.id),
        supabase.from('conceptos_costo').select('*').eq('embarque_id', embarqueOrigen.id),
      ]);

      const creados: { id: string; expediente: string }[] = [];

      for (const copia of copias) {
        const { data: nuevoEmbarque, error: errIns } = await supabase
          .from('embarques')
          .insert({
            expediente: embarqueOrigen.expediente,
            estado: 'Confirmado' as any,
            cliente_id: embarqueOrigen.cliente_id,
            cliente_nombre: embarqueOrigen.cliente_nombre,
            modo: embarqueOrigen.modo,
            tipo: embarqueOrigen.tipo,
            incoterm: embarqueOrigen.incoterm,
            bl_master: embarqueOrigen.bl_master,
            bl_house: embarqueOrigen.bl_house,
            naviera: embarqueOrigen.naviera,
            puerto_origen: embarqueOrigen.puerto_origen,
            puerto_destino: embarqueOrigen.puerto_destino,
            aeropuerto_origen: embarqueOrigen.aeropuerto_origen,
            aeropuerto_destino: embarqueOrigen.aeropuerto_destino,
            ciudad_origen: embarqueOrigen.ciudad_origen,
            ciudad_destino: embarqueOrigen.ciudad_destino,
            aerolinea: embarqueOrigen.aerolinea,
            transportista: embarqueOrigen.transportista,
            agente: embarqueOrigen.agente,
            shipper: embarqueOrigen.shipper,
            consignatario: embarqueOrigen.consignatario,
            descripcion_mercancia: embarqueOrigen.descripcion_mercancia,
            tipo_carga: embarqueOrigen.tipo_carga,
            tipo_servicio: embarqueOrigen.tipo_servicio,
            operador: embarqueOrigen.operador,
            mawb: embarqueOrigen.mawb,
            hawb: embarqueOrigen.hawb,
            carta_porte: embarqueOrigen.carta_porte,
            etd: embarqueOrigen.etd,
            eta: embarqueOrigen.eta,
            tipo_cambio_usd: embarqueOrigen.tipo_cambio_usd,
            tipo_cambio_eur: embarqueOrigen.tipo_cambio_eur,
            contenedor: copia.num_contenedor || null,
            tipo_contenedor: copia.tipo_contenedor || null,
            peso_kg: copia.peso_kg,
            volumen_m3: copia.volumen_m3,
            piezas: copia.piezas,
          })
          .select()
          .single();
        if (errIns) throw errIns;

        const nuevoId = nuevoEmbarque.id;
        const promesas: PromiseLike<any>[] = [];

        if (ventaOrigen && ventaOrigen.length > 0) {
          promesas.push(
            supabase.from('conceptos_venta').insert(
              ventaOrigen.map(cv => ({
                embarque_id: nuevoId,
                descripcion: cv.descripcion,
                cantidad: cv.cantidad,
                precio_unitario: cv.precio_unitario,
                moneda: cv.moneda,
                total: cv.total,
              }))
            )
          );
        }
        if (costoOrigen && costoOrigen.length > 0) {
          promesas.push(
            supabase.from('conceptos_costo').insert(
              costoOrigen.map(cc => ({
                embarque_id: nuevoId,
                concepto: cc.concepto,
                proveedor_nombre: cc.proveedor_nombre,
                proveedor_id: cc.proveedor_id,
                moneda: cc.moneda,
                monto: cc.monto,
              }))
            )
          );
        }
        promesas.push(
          supabase.from('notas_embarque').insert({
            embarque_id: nuevoId,
            contenido: `Embarque duplicado desde ${embarqueOrigen.expediente}`,
            tipo: 'sistema' as const,
          })
        );

        const results = await Promise.all(promesas);
        for (const r of results) {
          if (r.error) throw r.error;
        }

        creados.push({ id: nuevoId, expediente: embarqueOrigen.expediente });
      }

      return creados;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
    },
  });
}

// ─── Avanzar Estado ──────────────────────────────────────
export function useAvanzarEstadoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, nuevoEstado, usuarioEmail }: { embarqueId: string; nuevoEstado: string; usuarioEmail: string }) => {
      const { error: errorEstado } = await supabase
        .from('embarques')
        .update({ estado: nuevoEstado as any })
        .eq('id', embarqueId);
      if (errorEstado) throw errorEstado;

      const { error: errorNota } = await supabase
        .from('notas_embarque')
        .insert({
          embarque_id: embarqueId,
          contenido: `Estado cambiado a "${nuevoEstado}"`,
          tipo: 'cambio_estado' as const,
          usuario: usuarioEmail,
        });
      if (errorNota) throw errorNota;
    },
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
      queryClient.invalidateQueries({ queryKey: ['embarques', vars.embarqueId] });
      queryClient.invalidateQueries({ queryKey: ['notas_embarque', vars.embarqueId] });
    },
  });
}

// ─── Crear Nota ──────────────────────────────────────────
export function useCreateNotaEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, contenido, usuario }: { embarqueId: string; contenido: string; usuario: string }) => {
      const { error } = await supabase
        .from('notas_embarque')
        .insert({
          embarque_id: embarqueId,
          contenido,
          tipo: 'nota' as const,
          usuario,
        });
      if (error) throw error;
    },
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: ['notas_embarque', vars.embarqueId] });
    },
  });
}

// ─── Eliminar ────────────────────────────────────────────
export function useEliminarEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (embarqueId: string) => {
      const tablas = [
        'conceptos_venta',
        'conceptos_costo',
        'documentos_embarque',
        'notas_embarque',
        'facturas',
      ] as const;

      for (const tabla of tablas) {
        const { error } = await supabase.from(tabla).delete().eq('embarque_id', embarqueId);
        if (error) throw error;
      }

      const { error } = await supabase.from('embarques').delete().eq('id', embarqueId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
    },
  });
}
