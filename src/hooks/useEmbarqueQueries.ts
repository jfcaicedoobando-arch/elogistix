import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import type {
  EmbarqueRow,
  ConceptoVentaRow,
  ConceptoCostoRow,
  DocumentoEmbarqueRow,
  NotaEmbarqueRow,
} from './useEmbarqueUtils';

/** Columnas necesarias para listas y dashboard (evita select('*')) */
const EMBARQUE_LIST_COLUMNS = 'id, expediente, bl_master, cliente_id, cliente_nombre, modo, estado, etd, eta, operador, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, tipo_contenedor, descripcion_mercancia, tipo, created_at, tipo_cambio_usd, tipo_cambio_eur' as const;

export function useEmbarques() {
  return useQuery({
    queryKey: queryKeys.embarques.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('embarques')
        .select(EMBARQUE_LIST_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EmbarqueRow[];
    },
  });
}

export function useEmbarque(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.detail(id!),
    queryFn: async () => {
      if (!id) throw new Error('No id');
      const { data, error } = await supabase
        .from('embarques')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as EmbarqueRow;
    },
    enabled: !!id,
  });
}

export function useEmbarqueConceptosVenta(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.conceptosVenta(embarqueId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conceptos_venta')
        .select('*')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data as ConceptoVentaRow[];
    },
    enabled: !!embarqueId,
  });
}

export function useEmbarqueConceptosCosto(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.conceptosCosto(embarqueId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conceptos_costo')
        .select('*')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data as ConceptoCostoRow[];
    },
    enabled: !!embarqueId,
  });
}

export function useEmbarqueDocumentos(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.documentos(embarqueId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos_embarque')
        .select('*')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data as DocumentoEmbarqueRow[];
    },
    enabled: !!embarqueId,
  });
}

export function useEmbarqueNotas(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.notas(embarqueId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_embarque')
        .select('*')
        .eq('embarque_id', embarqueId!)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data as NotaEmbarqueRow[];
    },
    enabled: !!embarqueId,
  });
}

export function useEmbarqueFacturas(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.facturas(embarqueId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facturas')
        .select('*')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data;
    },
    enabled: !!embarqueId,
  });
}

export function useProveedoresForSelect() {
  return useQuery({
    queryKey: queryKeys.proveedores.select,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proveedores')
        .select('id, nombre')
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });
}
