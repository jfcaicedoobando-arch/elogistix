/**
 * Verifica si un embarque tiene documentos financieros asociados
 * (facturas CxC/CxP, notas de crédito o pagos) que impidan su eliminación.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FacturaLigada {
  id: string;
  folio: string | null;
  estado: string | null;
}

export interface EmbarqueDependenciasFinancieras {
  tieneDependencias: boolean;
  cxc: { count: number; facturas: FacturaLigada[] };
  cxp: { count: number; facturas: FacturaLigada[] };
  notasCredito: number;
  pagos: number;
}

const MAX_FOLIOS = 20;

async function fetchDependencias(embarqueId: string): Promise<EmbarqueDependenciasFinancieras> {
  const [cxcRes, cxpRes] = await Promise.all([
    supabase
      .from('facturas')
      .select('id, numero, estado', { count: 'exact' })
      .eq('embarque_id', embarqueId)
      .limit(MAX_FOLIOS),
    supabase
      .from('proveedor_facturas')
      .select('id, folio_proveedor, estado', { count: 'exact' })
      .eq('embarque_id', embarqueId)
      .limit(MAX_FOLIOS),
  ]);

  if (cxcRes.error) throw cxcRes.error;
  if (cxpRes.error) throw cxpRes.error;

  type CxcRow = { id: string; numero: string | null; estado: string | null };
  type CxpRow = { id: string; folio_proveedor: string | null; estado: string | null };

  const cxcRows = (cxcRes.data ?? []) as unknown as CxcRow[];
  const cxpRows = (cxpRes.data ?? []) as unknown as CxpRow[];

  const cxcFacturas: FacturaLigada[] = cxcRows.map((r) => ({
    id: r.id, folio: r.numero, estado: r.estado,
  }));
  const cxpFacturas: FacturaLigada[] = cxpRows.map((r) => ({
    id: r.id, folio: r.folio_proveedor, estado: r.estado,
  }));

  const cxcCount = cxcRes.count ?? cxcFacturas.length;
  const cxpCount = cxpRes.count ?? cxpFacturas.length;

  const cxcIds = cxcFacturas.map((f) => f.id);
  const cxpIds = cxpFacturas.map((f) => f.id);

  const [ncCxcRes, ncCxpRes, pagosCxcRes, pagosCxpRes] = await Promise.all([
    cxcIds.length
      ? supabase
          .from('factura_notas_credito')
          .select('id', { count: 'exact', head: true })
          .in('factura_id', cxcIds)
      : Promise.resolve({ count: 0, error: null }),
    cxpIds.length
      ? supabase
          .from('proveedor_notas_credito')
          .select('id', { count: 'exact', head: true })
          .in('factura_id', cxpIds)
      : Promise.resolve({ count: 0, error: null }),
    cxcIds.length
      ? supabase
          .from('pagos_factura')
          .select('id', { count: 'exact', head: true })
          .in('factura_id', cxcIds)
      : Promise.resolve({ count: 0, error: null }),
    cxpIds.length
      ? supabase
          .from('pagos_proveedor')
          .select('id', { count: 'exact', head: true })
          .in('factura_id', cxpIds)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (ncCxcRes.error) throw ncCxcRes.error;
  if (ncCxpRes.error) throw ncCxpRes.error;
  if (pagosCxcRes.error) throw pagosCxcRes.error;
  if (pagosCxpRes.error) throw pagosCxpRes.error;

  const notasCredito = (ncCxcRes.count ?? 0) + (ncCxpRes.count ?? 0);
  const pagos = (pagosCxcRes.count ?? 0) + (pagosCxpRes.count ?? 0);
  const tieneDependencias = cxcCount > 0 || cxpCount > 0 || notasCredito > 0 || pagos > 0;

  return {
    tieneDependencias,
    cxc: { count: cxcCount, facturas: cxcFacturas },
    cxp: { count: cxpCount, facturas: cxpFacturas },
    notasCredito,
    pagos,
  };
}

export function useEmbarqueDependenciasFinancieras(embarqueId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['embarques', 'dependencias-financieras', embarqueId],
    queryFn: () => fetchDependencias(embarqueId as string),
    enabled: enabled && Boolean(embarqueId),
    staleTime: 30_000,
  });
}
