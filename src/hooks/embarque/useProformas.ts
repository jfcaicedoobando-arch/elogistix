import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useOrgFilter } from '@/hooks/useOrgFilter';
import { toast } from 'sonner';

export type ProformaRow = Tables<'proformas'>;

/** Lista las proformas de un embarque (incluye URLs de la factura asociada si existe) */
export function useProformasEmbarque(embarqueId?: string) {
  return useQuery({
    queryKey: ['proformas', 'embarque', embarqueId],
    enabled: !!embarqueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proformas')
        .select('*, facturas:factura_id(factura_pdf_url, factura_xml_url)')
        .eq('embarque_id', embarqueId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // tipo se define más abajo, hacemos cast tras la declaración
      return data as unknown as Array<ProformaRow & { facturas: { factura_pdf_url: string | null; factura_xml_url: string | null } | null }>;
    },
    staleTime: 30_000,
  });
}

/**
 * Lista las proformas de la organización que ya pasaron revisión (aprobadas).
 * Excluye las pendientes de revisión y las consolidadas (originales que se fusionaron en otra).
 * Incluye URLs de la factura asociada si existe.
 */
export function useProformas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: ['proformas', 'all', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proformas')
        .select('*, facturas:factura_id(factura_pdf_url, factura_xml_url)')
        .eq('organization_id', organizationId!)
        .eq('estado_revision', 'aprobada')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProformaConFactura[];
    },
    staleTime: 30_000,
  });
}

export type ProformaPendienteConEmbarque = ProformaRow & {
  embarques: {
    expediente: string;
    bl_master: string | null;
    cliente_nombre: string;
    contenedor: string | null;
    tipo_contenedor: string | null;
  } | null;
};

/**
 * Lista las proformas pendientes de revisión, con datos del embarque
 * (contenedor, tipo_contenedor, bl_master) para poder agruparlas por expediente
 * y subagruparlas por contenedor en la nueva tab "Pendientes".
 */
export function useProformasPendientes() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: ['proformas', 'pendientes', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proformas')
        .select('*, embarques:embarque_id(expediente, bl_master, cliente_nombre, contenedor, tipo_contenedor)')
        .eq('organization_id', organizationId!)
        .eq('estado_revision', 'pendiente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProformaPendienteConEmbarque[];
    },
    staleTime: 30_000,
  });
}

export type ProformaConFactura = ProformaRow & {
  facturas: { factura_pdf_url: string | null; factura_xml_url: string | null } | null;
};

interface CrearProformaParams {
  embarqueId: string;
  clienteId: string;
  clienteNombre: string;
  expediente: string;
  blMaster?: string | null;
  conceptoIds: string[];
  totales: {
    subtotal_usd: number;
    iva_usd: number;
    total_usd: number;
    subtotal_mxn: number;
    iva_mxn: number;
    total_mxn: number;
  };
  notas?: string;
  operador?: string | null;
  diasCredito?: number | null;
  /** Mapa conceptoId → aplica_iva decidido por el usuario (solo USD; MXN siempre true) */
  ivaOverrides?: Record<string, boolean>;
}

/** Crea una proforma y marca conceptos como en_proforma */
export function useCrearProforma() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrgFilter();

  return useMutation({
    mutationFn: async (params: CrearProformaParams) => {
      if (!organizationId) throw new Error('Organización no disponible');
      if (params.conceptoIds.length === 0) throw new Error('Debe seleccionar al menos un concepto');

      // 0. Aplicar overrides de IVA en los conceptos seleccionados (uno por uno para respetar el valor)
      if (params.ivaOverrides) {
        const updates = Object.entries(params.ivaOverrides).map(([id, aplica]) =>
          supabase.from('conceptos_venta').update({ aplica_iva: aplica }).eq('id', id)
        );
        const results = await Promise.all(updates);
        const firstErr = results.find(r => r.error);
        if (firstErr?.error) throw firstErr.error;
      }

      // 1. Generar número consecutivo
      const { data: numero, error: errNum } = await supabase
        .rpc('generar_numero_proforma', { p_org_id: organizationId });
      if (errNum) throw errNum;

      // 2. Insertar proforma
      const { data: proforma, error: errProf } = await supabase
        .from('proformas')
        .insert({
          numero: numero as string,
          embarque_id: params.embarqueId,
          cliente_id: params.clienteId,
          cliente_nombre: params.clienteNombre,
          expediente: params.expediente,
          bl_master: params.blMaster ?? null,
          subtotal_usd: params.totales.subtotal_usd,
          iva_usd: params.totales.iva_usd,
          total_usd: params.totales.total_usd,
          subtotal_mxn: params.totales.subtotal_mxn,
          iva_mxn: params.totales.iva_mxn,
          total_mxn: params.totales.total_mxn,
          notas: params.notas ?? null,
          operador: params.operador ?? null,
          dias_credito: params.diasCredito ?? null,
          organization_id: organizationId,
        })
        .select()
        .single();
      if (errProf) throw errProf;

      // 3. Marcar conceptos como en_proforma
      const { error: errUpd } = await supabase
        .from('conceptos_venta')
        .update({
          estado_facturacion: 'en_proforma',
          proforma_id: proforma.id,
        })
        .in('id', params.conceptoIds);
      if (errUpd) {
        // Rollback: eliminar proforma creada
        await supabase.from('proformas').delete().eq('id', proforma.id);
        throw errUpd;
      }

      return proforma as ProformaRow;
    },
    onSuccess: (proforma) => {
      toast.success(`Proforma ${proforma.numero} generada`);
      queryClient.invalidateQueries({ queryKey: ['proformas', 'embarque', proforma.embarque_id] });
      queryClient.invalidateQueries({ queryKey: ['embarque', proforma.embarque_id] });
      queryClient.invalidateQueries({ queryKey: ['conceptos_venta'] });
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al generar proforma: ${error.message}`);
    },
  });
}

interface MarcarFacturadaParams {
  proformaId: string;
  embarqueId: string;
  folioFacturaExterna: string;
  fechaFacturacion: string; // YYYY-MM-DD
  pdfFile?: File | null;
  xmlFile?: File | null;
}

function addDays(yyyyMmDd: string, days: number): string {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Marca una proforma como facturada: sube archivos, crea registro(s) en facturas y actualiza la proforma */
export function useMarcarProformaFacturada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: MarcarFacturadaParams) => {
      // 1. Cargar proforma completa
      const { data: proforma, error: errProf } = await supabase
        .from('proformas')
        .select('*')
        .eq('id', params.proformaId)
        .single();
      if (errProf) throw errProf;

      // 2. Subir archivos (opcional)
      let pdfUrl: string | null = null;
      let xmlUrl: string | null = null;
      const basePath = `${proforma.organization_id}/${proforma.id}`;

      if (params.pdfFile) {
        const path = `${basePath}/factura.pdf`;
        const { error: errUp } = await supabase.storage
          .from('facturas')
          .upload(path, params.pdfFile, { upsert: true, contentType: 'application/pdf' });
        if (errUp) throw new Error(`Error al subir PDF: ${errUp.message}`);
        pdfUrl = supabase.storage.from('facturas').getPublicUrl(path).data.publicUrl;
      }
      if (params.xmlFile) {
        const path = `${basePath}/factura.xml`;
        const { error: errUp } = await supabase.storage
          .from('facturas')
          .upload(path, params.xmlFile, { upsert: true, contentType: 'application/xml' });
        if (errUp) throw new Error(`Error al subir XML: ${errUp.message}`);
        xmlUrl = supabase.storage.from('facturas').getPublicUrl(path).data.publicUrl;
      }

      // 3. Calcular vencimiento
      const dias = proforma.dias_credito ?? 0;
      const fechaVencimiento = addDays(params.fechaFacturacion, dias);

      // 4. Crear registros en facturas (uno por moneda con monto > 0)
      const facturasACrear: Array<{
        numero: string;
        proforma_id: string;
        embarque_id: string;
        cliente_id: string;
        cliente_nombre: string;
        expediente: string;
        fecha_emision: string;
        fecha_vencimiento: string;
        estado: 'Emitida';
        moneda: 'USD' | 'MXN';
        subtotal: number;
        iva: number;
        total: number;
        factura_pdf_url: string | null;
        factura_xml_url: string | null;
        organization_id: string;
      }> = [];

      const baseFactura = {
        numero: params.folioFacturaExterna,
        proforma_id: proforma.id,
        embarque_id: proforma.embarque_id,
        cliente_id: proforma.cliente_id,
        cliente_nombre: proforma.cliente_nombre,
        expediente: proforma.expediente,
        fecha_emision: params.fechaFacturacion,
        fecha_vencimiento: fechaVencimiento,
        estado: 'Emitida' as const,
        factura_pdf_url: pdfUrl,
        factura_xml_url: xmlUrl,
        organization_id: proforma.organization_id,
      };

      if (Number(proforma.total_usd) > 0) {
        facturasACrear.push({
          ...baseFactura,
          moneda: 'USD',
          subtotal: Number(proforma.subtotal_usd),
          iva: Number(proforma.iva_usd),
          total: Number(proforma.total_usd),
        });
      }
      if (Number(proforma.total_mxn) > 0) {
        facturasACrear.push({
          ...baseFactura,
          moneda: 'MXN',
          subtotal: Number(proforma.subtotal_mxn),
          iva: Number(proforma.iva_mxn),
          total: Number(proforma.total_mxn),
        });
      }

      let primeraFacturaId: string | null = null;
      if (facturasACrear.length > 0) {
        const { data: facturasCreadas, error: errFact } = await supabase
          .from('facturas')
          .insert(facturasACrear)
          .select('id');
        if (errFact) throw new Error(`Error al crear factura: ${errFact.message}`);
        primeraFacturaId = facturasCreadas?.[0]?.id ?? null;
      }

      // 5. Actualizar proforma
      const { error: errUpd } = await supabase
        .from('proformas')
        .update({
          estado_proforma: 'facturada',
          folio_factura_externa: params.folioFacturaExterna,
          fecha_facturacion: params.fechaFacturacion,
          factura_id: primeraFacturaId,
        })
        .eq('id', params.proformaId);
      if (errUpd) throw errUpd;

      return params;
    },
    onSuccess: (params) => {
      toast.success('Proforma facturada y registro de factura creado');
      queryClient.invalidateQueries({ queryKey: ['proformas', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['proformas', 'embarque', params.embarqueId] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });
}

interface EliminarProformaParams {
  proformaId: string;
  embarqueId: string;
  numero: string;
}

/** Elimina una proforma, libera sus conceptos y actualiza tiene_proforma del embarque */
export function useEliminarProforma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EliminarProformaParams) => {
      // 1. Liberar conceptos: pendiente y quitar proforma_id
      const { error: errUpd } = await supabase
        .from('conceptos_venta')
        .update({ estado_facturacion: 'pendiente', proforma_id: null })
        .eq('proforma_id', params.proformaId);
      if (errUpd) throw errUpd;

      // 2. Eliminar la proforma
      const { error: errDel } = await supabase
        .from('proformas')
        .delete()
        .eq('id', params.proformaId);
      if (errDel) throw errDel;

      // 3. Verificar si quedan otras proformas; si no, marcar tiene_proforma = false
      const { count, error: errCount } = await supabase
        .from('proformas')
        .select('id', { count: 'exact', head: true })
        .eq('embarque_id', params.embarqueId);
      if (errCount) throw errCount;

      if ((count ?? 0) === 0) {
        const { error: errEmb } = await supabase
          .from('embarques')
          .update({ tiene_proforma: false })
          .eq('id', params.embarqueId);
        if (errEmb) throw errEmb;
      }

      return params;
    },
    onSuccess: (params) => {
      toast.success('Proforma eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: ['proformas', 'embarque', params.embarqueId] });
      queryClient.invalidateQueries({ queryKey: ['proformas', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['embarque', params.embarqueId] });
      queryClient.invalidateQueries({ queryKey: ['conceptos_venta'] });
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar proforma: ${error.message}`);
    },
  });
}
