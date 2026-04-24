import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrgFilter } from '@/hooks/useOrgFilter';

export type EstadoProformaExpediente = 'sin_proforma' | 'parcial' | 'completa';

export interface EmbarqueDelExpediente {
  id: string;
  expediente: string;
  bl_master: string | null;
  contenedor: string | null;
  tipo_contenedor: string | null;
  cliente_id: string;
  cliente_nombre: string;
  operador: string | null;
}

export interface ProformaBorradorResumen {
  id: string;
  numero: string;
  embarque_id: string | null;
  embarques_ids: string[] | null;
  es_consolidada: boolean;
  total_usd: number;
  total_mxn: number;
  subtotal_usd: number;
  subtotal_mxn: number;
  iva_usd: number;
  iva_mxn: number;
  dias_credito: number | null;
  operador: string | null;
}

export interface ExpedienteConsolidado {
  /** Clave única: bl_master si existe, si no expediente */
  key: string;
  expediente: string;
  bl_master: string | null;
  cliente_id: string;
  cliente_nombre: string;
  operador: string | null;
  embarques: EmbarqueDelExpediente[];
  contenedoresCount: number;
  totalPendienteUSD: number;
  totalPendienteMXN: number;
  conceptosTotales: number;
  conceptosPendientes: number;
  estadoProforma: EstadoProformaExpediente;
  /** Proformas en estado borrador asociadas a este expediente */
  proformasBorrador: ProformaBorradorResumen[];
  /** Total de las proformas borrador (para mostrar en la fila) */
  totalBorradorUSD: number;
  totalBorradorMXN: number;
}

/**
 * Devuelve los expedientes agrupados por BL Master (o por expediente si no tiene BL)
 * con totales pendientes de facturar y estado de proforma.
 */
export function useExpedientesConsolidados() {
  const { organizationId } = useOrgFilter();

  return useQuery({
    queryKey: ['expedientes-consolidados', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<ExpedienteConsolidado[]> => {
      // 1. Cargar embarques de la org
      const { data: embarques, error: errEmb } = await supabase
        .from('embarques')
        .select('id, expediente, bl_master, contenedor, tipo_contenedor, cliente_id, cliente_nombre, operador, estado')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false });
      if (errEmb) throw errEmb;
      if (!embarques?.length) return [];

      const embarqueIds = embarques.map(e => e.id);

      // 2. Conceptos de venta
      const { data: conceptos, error: errC } = await supabase
        .from('conceptos_venta')
        .select('id, embarque_id, cantidad, precio_unitario, moneda, estado_facturacion')
        .in('embarque_id', embarqueIds);
      if (errC) throw errC;

      // 3. Proformas en BORRADOR
      const { data: proformasBorrador, error: errP } = await supabase
        .from('proformas')
        .select('id, numero, embarque_id, embarques_ids, es_consolidada, total_usd, total_mxn, subtotal_usd, subtotal_mxn, iva_usd, iva_mxn, dias_credito, operador')
        .eq('organization_id', organizationId!)
        .eq('estado_aprobacion', 'borrador');
      if (errP) throw errP;

      const conceptosByEmb = new Map<string, typeof conceptos>();
      (conceptos || []).forEach(c => {
        const arr = conceptosByEmb.get(c.embarque_id) || [];
        arr.push(c);
        conceptosByEmb.set(c.embarque_id, arr);
      });

      // 4. Agrupar embarques por BL Master (o expediente si no hay BL)
      const grupos = new Map<string, ExpedienteConsolidado>();
      const embarqueToKey = new Map<string, string>();

      for (const e of embarques) {
        const key = e.bl_master?.trim() || e.expediente;
        embarqueToKey.set(e.id, key);
        let grupo = grupos.get(key);
        if (!grupo) {
          grupo = {
            key,
            expediente: e.expediente,
            bl_master: e.bl_master,
            cliente_id: e.cliente_id,
            cliente_nombre: e.cliente_nombre,
            operador: e.operador,
            embarques: [],
            contenedoresCount: 0,
            totalPendienteUSD: 0,
            totalPendienteMXN: 0,
            conceptosTotales: 0,
            conceptosPendientes: 0,
            estadoProforma: 'sin_proforma',
            proformasBorrador: [],
            totalBorradorUSD: 0,
            totalBorradorMXN: 0,
          };
          grupos.set(key, grupo);
        }
        grupo.embarques.push({
          id: e.id,
          expediente: e.expediente,
          bl_master: e.bl_master,
          contenedor: e.contenedor,
          tipo_contenedor: e.tipo_contenedor,
          cliente_id: e.cliente_id,
          cliente_nombre: e.cliente_nombre,
          operador: e.operador,
        });
        grupo.contenedoresCount += 1;

        const cs = conceptosByEmb.get(e.id) || [];
        cs.forEach(c => {
          grupo!.conceptosTotales += 1;
          const enProforma = c.estado_facturacion === 'en_proforma' || c.estado_facturacion === 'facturado';
          if (!enProforma) {
            grupo!.conceptosPendientes += 1;
            const sub = Number(c.cantidad) * Number(c.precio_unitario);
            if (c.moneda === 'USD') grupo!.totalPendienteUSD += sub;
            else if (c.moneda === 'MXN') grupo!.totalPendienteMXN += sub;
          }
        });
      }

      // 5. Asignar proformas borrador al grupo correspondiente
      for (const p of proformasBorrador || []) {
        const refEmb = p.embarque_id ?? (p.embarques_ids && p.embarques_ids[0]);
        if (!refEmb) continue;
        const key = embarqueToKey.get(refEmb);
        if (!key) continue;
        const grupo = grupos.get(key);
        if (!grupo) continue;
        grupo.proformasBorrador.push({
          id: p.id,
          numero: p.numero,
          embarque_id: p.embarque_id,
          embarques_ids: p.embarques_ids ?? null,
          es_consolidada: p.es_consolidada,
          total_usd: Number(p.total_usd),
          total_mxn: Number(p.total_mxn),
          subtotal_usd: Number(p.subtotal_usd),
          subtotal_mxn: Number(p.subtotal_mxn),
          iva_usd: Number(p.iva_usd),
          iva_mxn: Number(p.iva_mxn),
          dias_credito: p.dias_credito,
          operador: p.operador,
        });
        grupo.totalBorradorUSD += Number(p.total_usd);
        grupo.totalBorradorMXN += Number(p.total_mxn);
      }

      // 6. Calcular estado de proforma por grupo
      const result: ExpedienteConsolidado[] = [];
      for (const g of grupos.values()) {
        if (g.conceptosTotales === 0) g.estadoProforma = 'sin_proforma';
        else if (g.conceptosPendientes === g.conceptosTotales) g.estadoProforma = 'sin_proforma';
        else if (g.conceptosPendientes === 0) g.estadoProforma = 'completa';
        else g.estadoProforma = 'parcial';
        result.push(g);
      }

      return result;
    },
    staleTime: 30_000,
  });
}
