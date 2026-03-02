import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export interface ConceptoVentaCotizacion {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  moneda: string;
  total: number;
}

export interface DimensionLCL {
  piezas: number;
  alto_cm: number;
  largo_cm: number;
  ancho_cm: number;
  volumen_m3: number;
}

export interface DimensionAerea {
  piezas: number;
  alto_cm: number;
  largo_cm: number;
  ancho_cm: number;
  peso_volumetrico_kg: number;
}

export interface CotizacionRow {
  id: string;
  folio: string;
  cliente_id: string | null;
  cliente_nombre: string;
  es_prospecto: boolean;
  prospecto_empresa: string;
  prospecto_contacto: string;
  prospecto_email: string;
  prospecto_telefono: string;
  modo: string;
  tipo: string;
  incoterm: string;
  descripcion_mercancia: string;
  peso_kg: number;
  volumen_m3: number;
  piezas: number;
  origen: string;
  destino: string;
  conceptos_venta: ConceptoVentaCotizacion[];
  subtotal: number;
  moneda: string;
  vigencia_dias: number;
  fecha_vigencia: string | null;
  notas: string | null;
  estado: string;
  embarque_id: string | null;
  operador: string;
  tipo_carga: string;
  msds_archivo: string | null;
  tipo_embarque: string;
  tipo_contenedor: string | null;
  tipo_peso: string;
  descripcion_adicional: string;
  sector_economico: string;
  dimensiones_lcl: DimensionLCL[];
  dimensiones_aereas: DimensionAerea[];
  created_at: string;
  updated_at: string;
}

export function useCotizaciones() {
  return useQuery({
    queryKey: ['cotizaciones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotizaciones')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CotizacionRow[];
    },
  });
}

export function useCotizacion(id: string | undefined) {
  return useQuery({
    queryKey: ['cotizaciones', id],
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

export interface CreateCotizacionInput {
  cliente_id?: string | null;
  cliente_nombre: string;
  es_prospecto: boolean;
  prospecto_empresa?: string;
  prospecto_contacto?: string;
  prospecto_email?: string;
  prospecto_telefono?: string;
  modo: string;
  tipo: string;
  incoterm: string;
  descripcion_mercancia: string;
  peso_kg: number;
  volumen_m3: number;
  piezas: number;
  origen: string;
  destino: string;
  conceptos_venta: ConceptoVentaCotizacion[];
  subtotal: number;
  moneda: string;
  vigencia_dias: number;
  notas: string;
  operador: string;
  tipo_carga?: string;
  msds_archivo?: string | null;
  tipo_embarque?: string;
  tipo_contenedor?: string | null;
  tipo_peso?: string;
  descripcion_adicional?: string;
  sector_economico?: string;
  dimensiones_lcl?: DimensionLCL[];
  dimensiones_aereas?: DimensionAerea[];
}

export function useCreateCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCotizacionInput) => {
      const folio = await generarFolio();
      const fechaVigencia = new Date();
      fechaVigencia.setDate(fechaVigencia.getDate() + input.vigencia_dias);

      const { data, error } = await supabase
        .from('cotizaciones')
        .insert({
          folio,
          cliente_id: input.es_prospecto ? null : input.cliente_id,
          cliente_nombre: input.cliente_nombre,
          es_prospecto: input.es_prospecto,
          prospecto_empresa: input.prospecto_empresa || '',
          prospecto_contacto: input.prospecto_contacto || '',
          prospecto_email: input.prospecto_email || '',
          prospecto_telefono: input.prospecto_telefono || '',
          modo: input.modo as any,
          tipo: input.tipo as any,
          incoterm: input.incoterm as any,
          descripcion_mercancia: input.descripcion_mercancia,
          peso_kg: input.peso_kg,
          volumen_m3: input.volumen_m3,
          piezas: input.piezas,
          origen: input.origen,
          destino: input.destino,
          conceptos_venta: input.conceptos_venta as unknown as Json,
          subtotal: input.subtotal,
          moneda: input.moneda as any,
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
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CotizacionRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
    },
  });
}

export function useUpdateEstadoCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const { error } = await supabase
        .from('cotizaciones')
        .update({ estado: estado as any })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['cotizaciones', vars.id] });
    },
  });
}

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
        } as any)
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
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

/** Crea un embarque desde una cotización aceptada */
export function useCrearEmbarqueDesdeCotizacion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (cotizacion: CotizacionRow) => {
      if (!cotizacion.cliente_id) {
        throw new Error('La cotización debe tener un cliente asignado antes de crear el embarque.');
      }

      const anio = new Date().getFullYear();
      const prefijoExp = `EXP-${anio}-`;
      const { data: ultimoEmbarque } = await supabase
        .from('embarques')
        .select('expediente')
        .like('expediente', `${prefijoExp}%`)
        .order('expediente', { ascending: false })
        .limit(1);
      let sigExp = 1;
      if (ultimoEmbarque && ultimoEmbarque.length > 0) {
        const num = parseInt(ultimoEmbarque[0].expediente.replace(prefijoExp, ''), 10);
        if (!isNaN(num)) sigExp = num + 1;
      }
      const expediente = `${prefijoExp}${String(sigExp).padStart(4, '0')}`;

      const { data: embarqueCreado, error: errorEmbarque } = await supabase
        .from('embarques')
        .insert({
          expediente,
          cliente_id: cotizacion.cliente_id,
          cliente_nombre: cotizacion.cliente_nombre,
          modo: cotizacion.modo as any,
          tipo: cotizacion.tipo as any,
          incoterm: cotizacion.incoterm as any,
          descripcion_mercancia: cotizacion.descripcion_mercancia,
          peso_kg: cotizacion.peso_kg,
          volumen_m3: cotizacion.volumen_m3,
          piezas: cotizacion.piezas,
          estado: 'Cotización' as any,
          operador: cotizacion.operador,
          tipo_contenedor: cotizacion.tipo_contenedor || null,
          tipo_servicio: cotizacion.modo === 'Marítimo' ? (cotizacion.tipo_embarque as any) : null,
        })
        .select()
        .single();
      if (errorEmbarque) throw errorEmbarque;

      if (cotizacion.conceptos_venta.length > 0) {
        const { error: errorConceptos } = await supabase.from('conceptos_venta').insert(
          cotizacion.conceptos_venta.map(c => ({
            embarque_id: embarqueCreado.id,
            descripcion: c.descripcion,
            cantidad: c.cantidad,
            precio_unitario: c.precio_unitario,
            moneda: c.moneda as any,
            total: c.total,
          }))
        );
        if (errorConceptos) throw errorConceptos;
      }

      const { error: errorActualizar } = await supabase
        .from('cotizaciones')
        .update({ estado: 'Confirmada' as any, embarque_id: embarqueCreado.id } as any)
        .eq('id', cotizacion.id);
      if (errorActualizar) throw errorActualizar;

      await supabase.from('notas_embarque').insert({
        embarque_id: embarqueCreado.id,
        contenido: `Embarque creado desde cotización ${cotizacion.folio}`,
        tipo: 'sistema' as const,
      });

      if (user) {
        await supabase.from('bitacora_actividad').insert({
          usuario_id: user.id,
          usuario_email: user.email ?? '',
          accion: 'Crear embarque desde cotización',
          modulo: 'Cotizaciones',
          entidad_id: cotizacion.id,
          entidad_nombre: cotizacion.folio,
          detalles: { embarque_id: embarqueCreado.id, expediente } as unknown as Json,
        });
      }

      return embarqueCreado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
    },
  });
}

/** @deprecated Usa useCrearEmbarqueDesdeCotizacion en su lugar */
export const useConfirmarCotizacion = useCrearEmbarqueDesdeCotizacion;
