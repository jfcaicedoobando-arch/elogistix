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
      // 1. Cargar embarques activos de la org (no cerrados/cancelados)
      const { data: embarques, error: errEmb } = await supabase
        .from('embarques')
        .select('id, expediente, bl_master, contenedor, tipo_contenedor, cliente_id, cliente_nombre, operador, estado')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false });
      if (errEmb) throw errEmb;
      if (!embarques?.length) return [];

      const embarqueIds = embarques.map(e => e.id);

      // 2. Cargar conceptos de venta de esos embarques
      const { data: conceptos, error: errC } = await supabase
        .from('conceptos_venta')
        .select('id, embarque_id, cantidad, precio_unitario, moneda, estado_facturacion')
        .in('embarque_id', embarqueIds);
      if (errC) throw errC;

      const conceptosByEmb = new Map<string, typeof conceptos>();
      (conceptos || []).forEach(c => {
        const arr = conceptosByEmb.get(c.embarque_id) || [];
        arr.push(c);
        conceptosByEmb.set(c.embarque_id, arr);
      });

      // 3. Agrupar embarques por BL Master (o expediente si no hay BL)
      const grupos = new Map<string, ExpedienteConsolidado>();
      for (const e of embarques) {
        const key = e.bl_master?.trim() || e.expediente;
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

      // 4. Calcular estado de proforma por grupo
      const result: ExpedienteConsolidado[] = [];
      for (const g of grupos.values()) {
        if (g.conceptosTotales === 0) {
          g.estadoProforma = 'sin_proforma';
        } else if (g.conceptosPendientes === g.conceptosTotales) {
          g.estadoProforma = 'sin_proforma';
        } else if (g.conceptosPendientes === 0) {
          g.estadoProforma = 'completa';
        } else {
          g.estadoProforma = 'parcial';
        }
        result.push(g);
      }

      return result;
    },
    staleTime: 30_000,
  });
}
