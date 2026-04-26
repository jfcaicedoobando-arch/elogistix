import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query';
import {
  crearEmbarqueRpc,
  actualizarEmbarqueRpc,
  duplicarEmbarqueRpc,
  eliminarEmbarqueRpc,
  actualizarEstadoEmbarque,
  insertarNotaCambioEstado,
  insertarNotaEmbarque,
  insertEventoEmbarque,
  uploadDocumentoEmbarque,
  deleteDocumentoEmbarque,
} from '@/services/embarqueServices';

type EmbarqueRow = Tables<'embarques'>;

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
    mutationFn: async (input: CreateEmbarqueInput) => {
      const result = await crearEmbarqueRpc(input);
      return { id: result.id } as unknown as EmbarqueRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
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
    mutationFn: async (input: UpdateEmbarqueInput) => {
      await actualizarEmbarqueRpc(input);
      return { id: input.id } as EmbarqueRow;
    },
    onSuccess: (embarqueActualizado) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVenta(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.conceptosCosto(embarqueActualizado.id) });
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
    mutationFn: ({ embarqueOrigen, copias }: DuplicarEmbarqueInput) =>
      duplicarEmbarqueRpc(embarqueOrigen.id, copias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
    },
  });
}

// ─── Mapeo estado → tipo evento tracking ─────────────────
import {
  tipoEventoParaEstado,
  descripcionEventoCambioEstado,
} from '@/lib/domain/embarque';

async function insertarEventoTracking(embarqueId: string, nuevoEstado: string, usuario: string) {
  await insertEventoEmbarque({
    embarqueId,
    tipo: tipoEventoParaEstado(nuevoEstado),
    descripcion: descripcionEventoCambioEstado(nuevoEstado),
    ubicacion: '',
    fecha: new Date().toISOString(),
    usuario,
  });
}

// ─── Avanzar Estado ──────────────────────────────────────
export function useAvanzarEstadoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, nuevoEstado, usuarioEmail }: { embarqueId: string; nuevoEstado: string; usuarioEmail: string }) => {
      await actualizarEstadoEmbarque(embarqueId, nuevoEstado);
      await insertarNotaCambioEstado(embarqueId, `Estado cambiado a "${nuevoEstado}"`, usuarioEmail);
      await insertarEventoTracking(embarqueId, nuevoEstado, usuarioEmail);
    },
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.notas(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
    },
  });
}

// ─── Sincronizar Estado Calculado ─────────────────────────
export function useSyncEstadoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, nuevoEstado }: { embarqueId: string; nuevoEstado: string }) => {
      await actualizarEstadoEmbarque(embarqueId, nuevoEstado);
      await insertarEventoTracking(embarqueId, nuevoEstado, 'sistema');
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
    },
  });
}

// ─── Upload Documento ────────────────────────────────────
export function useUploadDocumentoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueId, docId, file }: { embarqueId: string; docId: string; file: File }) =>
      uploadDocumentoEmbarque(embarqueId, docId, file),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.documentos(vars.embarqueId) });
    },
  });
}

// ─── Delete Documento ────────────────────────────────────
export function useDeleteDocumentoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, archivoPath }: { embarqueId: string; docId: string; archivoPath: string }) =>
      deleteDocumentoEmbarque(docId, archivoPath),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.documentos(vars.embarqueId) });
    },
  });
}

// ─── Crear Nota ──────────────────────────────────────────
export function useCreateNotaEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueId, contenido, usuario }: { embarqueId: string; contenido: string; usuario: string }) =>
      insertarNotaEmbarque(embarqueId, contenido, usuario),
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.notas(vars.embarqueId) });
    },
  });
}

// ─── Eliminar ────────────────────────────────────────────
export function useEliminarEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (embarqueId: string) => eliminarEmbarqueRpc(embarqueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}
