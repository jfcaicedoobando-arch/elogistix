/**
 * Service: dependencias financieras de un embarque.
 *
 * Verifica si un embarque tiene facturas CxC/CxP, notas de crédito o pagos
 * que impidan su eliminación. Centraliza el acceso a Supabase fuera del hook
 * (Pages → Hooks → **Services** → Lib).
 */
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
  proformas: number;
}


const MAX_FOLIOS = 20;

interface CountResult {
  count: number | null;
  error: { message: string } | null;
}

async function fetchFacturasLigadas(embarqueId: string): Promise<{ cxc: FacturaLigada[]; cxcCount: number; cxp: FacturaLigada[]; cxpCount: number }> {
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

  const cxc: FacturaLigada[] = (cxcRes.data ?? []).map((r) => ({ id: r.id, folio: r.numero, estado: r.estado }));
  const cxp: FacturaLigada[] = (cxpRes.data ?? []).map((r) => ({ id: r.id, folio: r.folio_proveedor, estado: r.estado }));
  return {
    cxc,
    cxcCount: cxcRes.count ?? cxc.length,
    cxp,
    cxpCount: cxpRes.count ?? cxp.length,
  };
}

async function fetchNotasYPagos(cxcIds: string[], cxpIds: string[]): Promise<{ notasCredito: number; pagos: number }> {
  const empty: CountResult = { count: 0, error: null };
  const [ncCxcRes, ncCxpRes, pagosCxcRes, pagosCxpRes] = await Promise.all<CountResult>([
    cxcIds.length
      ? supabase.from('factura_notas_credito').select('id', { count: 'exact', head: true }).in('factura_id', cxcIds)
      : Promise.resolve(empty),
    cxpIds.length
      ? supabase.from('proveedor_notas_credito').select('id', { count: 'exact', head: true }).in('factura_id', cxpIds)
      : Promise.resolve(empty),
    cxcIds.length
      ? supabase.from('pagos_factura').select('id', { count: 'exact', head: true }).in('factura_id', cxcIds)
      : Promise.resolve(empty),
    cxpIds.length
      ? supabase.from('pagos_proveedor').select('id', { count: 'exact', head: true }).in('factura_id', cxpIds)
      : Promise.resolve(empty),
  ]);

  if (ncCxcRes.error) throw ncCxcRes.error;
  if (ncCxpRes.error) throw ncCxpRes.error;
  if (pagosCxcRes.error) throw pagosCxcRes.error;
  if (pagosCxpRes.error) throw pagosCxpRes.error;

  return {
    notasCredito: (ncCxcRes.count ?? 0) + (ncCxpRes.count ?? 0),
    pagos: (pagosCxcRes.count ?? 0) + (pagosCxpRes.count ?? 0),
  };
}

export async function fetchEmbarqueDependenciasFinancieras(
  embarqueId: string,
): Promise<EmbarqueDependenciasFinancieras> {
  const { cxc, cxcCount, cxp, cxpCount } = await fetchFacturasLigadas(embarqueId);
  const { notasCredito, pagos } = await fetchNotasYPagos(
    cxc.map((f) => f.id),
    cxp.map((f) => f.id),
  );
  const tieneDependencias = cxcCount > 0 || cxpCount > 0 || notasCredito > 0 || pagos > 0;

  return {
    tieneDependencias,
    cxc: { count: cxcCount, facturas: cxc },
    cxp: { count: cxpCount, facturas: cxp },
    notasCredito,
    pagos,
  };
}
