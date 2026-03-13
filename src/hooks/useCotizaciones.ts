import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json, Tables, TablesInsert } from '@/integrations/supabase/types';

type CotizacionInsert = TablesInsert<'cotizaciones'>;
type EmbarqueInsert = TablesInsert<'embarques'>;
type CotizacionUpdate = Partial<CotizacionInsert>;
import { queryKeys } from '@/lib/queryKeys';

export interface ConceptoVentaCotizacion {
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  moneda: string;
  total: number;
  aplica_iva: boolean;
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

/** CotizacionRow extiende la tabla generada, sobreescribiendo los campos JSON */
export type CotizacionRow = Omit<Tables<'cotizaciones'>, 'conceptos_venta' | 'dimensiones_lcl' | 'dimensiones_aereas'> & {
  conceptos_venta: ConceptoVentaCotizacion[];
  dimensiones_lcl: DimensionLCL[];
  dimensiones_aereas: DimensionAerea[];
};

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
  dias_libres_destino?: number;
  dias_almacenaje?: number;
  tiempo_transito_dias?: number | null;
  frecuencia?: string;
  ruta_texto?: string;
  validez_propuesta?: string | null;
  tipo_movimiento?: string;
  seguro?: boolean;
  valor_seguro_usd?: number;
  carta_garantia?: boolean;
  num_contenedores?: number;
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
      const updatePayload: CotizacionUpdate = { ...data } as CotizacionUpdate;
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
        const { data: embarque, error: errorEmb } = await supabase
          .from('embarques')
          .insert({
            cotizacion_id: cotizacion.id,
            expediente: expediente as string,
            cliente_id: cotizacion.cliente_id!,
            cliente_nombre: cotizacion.cliente_nombre,
            estado: 'Confirmado' as any,
            modo: cotizacion.modo as any,
            tipo: cotizacion.tipo as any,
            incoterm: cotizacion.incoterm as any,
            descripcion_mercancia: cotizacion.descripcion_mercancia,
            peso_kg: cotizacion.peso_kg,
            volumen_m3: cotizacion.volumen_m3,
            piezas: cotizacion.piezas,
            operador: cotizacion.operador,
            tipo_carga: cotizacion.tipo_carga,
            tipo_contenedor: cotizacion.tipo_contenedor,
          } as any)
          .select()
          .single();
        if (errorEmb) throw errorEmb;

        // c. Insertar conceptos de costo según unidad_medida
        if (costos && costos.length > 0) {
          const conceptosParaInsertar = costos.filter((c: any) => {
            const um = c.unidad_medida ?? 'Contenedor';
            if (um === 'BL') return i === 0;
            return true; // Contenedor, Embarque, W/M → todos
          });

          if (conceptosParaInsertar.length > 0) {
            const rows = conceptosParaInsertar.map((c: any) => ({
              embarque_id: embarque.id,
              concepto: c.concepto,
              monto: c.costo_unitario,
              moneda: c.moneda as any,
              proveedor_nombre: c.proveedor,
            }));

            const { error: errorConceptos } = await supabase
              .from('conceptos_costo')
              .insert(rows as any);
            if (errorConceptos) throw errorConceptos;
          }
        }

        embarquesCreados.push(embarque);
      }

      // 3. Actualizar estado de la cotización
      const { error: errorUpdate } = await supabase
        .from('cotizaciones')
        .update({ estado: 'Embarcada' as any })
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
