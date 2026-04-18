import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/queryKeys';
import { useOrgFilter } from '@/hooks/useOrgFilter';

type EmbarqueRow = Tables<'embarques'>;
type ConceptoVentaRow = Tables<'conceptos_venta'>;
type ConceptoCostoRow = Tables<'conceptos_costo'>;
type DocumentoEmbarqueRow = Tables<'documentos_embarque'>;
type NotaEmbarqueRow = Tables<'notas_embarque'>;

/** Columnas necesarias para listas y dashboard (evita select('*')) */
const EMBARQUE_LIST_COLUMNS = 'id, expediente, bl_master, cliente_id, cliente_nombre, modo, estado, etd, eta, operador, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, contenedor, tipo_contenedor, descripcion_mercancia, tipo, created_at, tipo_cambio_usd, tipo_cambio_eur' as const;

/** Hook original: descarga TODOS los embarques. Usar solo para Dashboard/Operaciones que necesitan el dataset completo. */
export function useEmbarques() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.embarques.all, organizationId],
    queryFn: async () => {
      let query = supabase
        .from('embarques')
        .select(EMBARQUE_LIST_COLUMNS)
        .order('created_at', { ascending: false });
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw error;
      return data as EmbarqueRow[];
    },
    staleTime: 60_000,
  });
}

// --- Hook paginado server-side para la vista de lista ---

interface UseEmbarquesPaginadosParams {
  search: string;
  filterModo: string;
  filterEstado: string;
  filterCliente: string;
  filterOperador: string;
  page: number;
  pageSize: number;
  fechaDesde?: string;
  fechaHasta?: string;
}

export function useEmbarquesPaginados({
  search, filterModo, filterEstado, filterCliente, filterOperador, page, pageSize, fechaDesde, fechaHasta,
}: UseEmbarquesPaginadosParams) {
  const { organizationId } = useOrgFilter();
  const filters = { search, filterModo, filterEstado, filterCliente, filterOperador, page, pageSize, fechaDesde, fechaHasta, organizationId };

  return useQuery({
    queryKey: queryKeys.embarques.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('embarques')
        .select(EMBARQUE_LIST_COLUMNS, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (organizationId) query = query.eq('organization_id', organizationId);

      // Text search across multiple columns
      if (search) {
        query = query.or(
          `expediente.ilike.%${search}%,cliente_nombre.ilike.%${search}%,descripcion_mercancia.ilike.%${search}%,bl_master.ilike.%${search}%`
        );
      }

      if (filterModo !== 'todos') {
        query = query.eq('modo', filterModo as TablesInsert<'embarques'>['modo']);
      }
      // Estado filtering is done client-side because calcularEstadoEmbarque derives estado from ETD/ETA
      if (filterCliente !== 'todos') {
        query = query.eq('cliente_id', filterCliente);
      }
      if (filterOperador !== 'todos') {
        query = query.eq('operador', filterOperador);
      }
      if (fechaDesde) {
        query = query.gte('etd', fechaDesde);
      }
      if (fechaHasta) {
        query = query.lte('eta', fechaHasta);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as EmbarqueRow[], count: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });
}

/** Columnas completas para vista detalle (todas excepto las que nunca se leen aquí) */
const EMBARQUE_DETAIL_COLUMNS = 'id, expediente, bl_master, bl_house, mawb, hawb, carta_porte, cliente_id, cliente_nombre, consignatario, shipper, modo, tipo, estado, etd, eta, fecha_creacion, fecha_llegada_real, operador, agente, naviera, aerolinea, transportista, contenedor, tipo_contenedor, tipo_servicio, tipo_carga, descripcion_mercancia, peso_kg, volumen_m3, piezas, incoterm, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, msds_archivo, organization_id, cotizacion_id, tipo_cambio_usd, tipo_cambio_eur, created_at, updated_at' as const;

export function useEmbarque(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.detail(id!),
    queryFn: async () => {
      if (!id) throw new Error('No id');
      const { data, error } = await supabase
        .from('embarques')
        .select(EMBARQUE_DETAIL_COLUMNS)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as EmbarqueRow;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useEmbarqueConceptosVenta(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.conceptosVenta(embarqueId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conceptos_venta')
        .select('id, embarque_id, descripcion, cantidad, precio_unitario, total, moneda, organization_id, created_at')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data as ConceptoVentaRow[];
    },
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
}

export function useEmbarqueConceptosCosto(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.conceptosCosto(embarqueId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conceptos_costo')
        .select('id, embarque_id, concepto, monto, moneda, proveedor_id, proveedor_nombre, estado_liquidacion, fecha_pago, fecha_vencimiento, referencia_pago, organization_id, created_at')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data as ConceptoCostoRow[];
    },
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
}

export function useEmbarqueDocumentos(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.documentos(embarqueId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos_embarque')
        .select('id, embarque_id, nombre, archivo, estado, notas, organization_id, created_at')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data as DocumentoEmbarqueRow[];
    },
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
}

export function useEmbarqueNotas(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.notas(embarqueId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_embarque')
        .select('id, embarque_id, contenido, tipo, fecha, usuario, organization_id, created_at')
        .eq('embarque_id', embarqueId!)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data as NotaEmbarqueRow[];
    },
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
}

export function useEmbarqueFacturas(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.facturas(embarqueId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facturas')
        .select('id, numero, embarque_id, expediente, cliente_id, cliente_nombre, estado, moneda, subtotal, iva, total, tipo_cambio, fecha_emision, fecha_vencimiento, referencia_bl, notas, organization_id, created_at, updated_at')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data;
    },
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
}

export interface ExpedienteCliente {
  expediente: string;
  bl_master: string | null;
  cliente_nombre: string;
  total_embarques: number;
}

export function useExpedientesCliente(clienteId: string | undefined) {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.embarques.all, 'expedientes-cliente', clienteId, organizationId],
    staleTime: 60_000,
    queryFn: async () => {
      if (!clienteId) return [];
      const { data, error } = await supabase
        .from('embarques')
        .select('expediente, bl_master, cliente_nombre')
        .eq('cliente_id', clienteId)
        .neq('estado', 'Cerrado')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Group by expediente and count
      const map = new Map<string, ExpedienteCliente>();
      for (const row of data ?? []) {
        const existing = map.get(row.expediente);
        if (existing) {
          existing.total_embarques++;
        } else {
          map.set(row.expediente, {
            expediente: row.expediente,
            bl_master: row.bl_master,
            cliente_nombre: row.cliente_nombre,
            total_embarques: 1,
          });
        }
      }
      return Array.from(map.values());
    },
    enabled: !!clienteId,
  });
}

export function useProveedoresForSelect() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.proveedores.select, organizationId],
    queryFn: async () => {
      let query = supabase
        .from('proveedores')
        .select('id, nombre')
        .order('nombre');
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}
