/**
 * Service: dependencias financieras de un embarque.
 *
 * Verifica si un embarque tiene facturas CxC/CxP, notas de crédito o pagos
 * que impidan su eliminación. Centraliza el acceso a Supabase fuera del hook
 * (Pages → Hooks → **Services** → Lib).
 */
import { supabase } from '@/integrations/supabase/client';
import { countInChunks } from '@/lib/supabase/chunkedIn';

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

async function fetchFacturasLigadas(embarqueId: string): Promise<{ cxc: FacturaLigada[]; cxcCount: number; cxp: FacturaLigada[]; cxpCount: number }> {
  const [cxcRes, cxpRes] = await Promise.all([
    supabase
      .from('facturas')
      .select('id, numero, estado', { count: 'exact' })
      .eq('embarque_id', embarqueId)
      .is('deleted_at', null)
      .limit(MAX_FOLIOS),
    supabase
      .from('proveedor_facturas')
      .select('id, folio_proveedor, estado', { count: 'exact' })
      .eq('embarque_id', embarqueId)
      .is('deleted_at', null)
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

type TablaConteo = 'factura_notas_credito' | 'proveedor_notas_credito' | 'pagos_factura' | 'pagos_proveedor';

/** Conteo por lotes de IDs (O5.9): evita URLs gigantes en el filtro `.in`. */
async function contarPorFacturaIds(tabla: TablaConteo, ids: string[]): Promise<number> {
  return countInChunks(ids, async (lote) => {
    const { count, error } = await supabase
      .from(tabla)
      .select('id', { count: 'exact', head: true })
      .in('factura_id', lote)
      .is('deleted_at', null);
    if (error) throw error;
    return count ?? 0;
  });
}

async function fetchNotasYPagos(cxcIds: string[], cxpIds: string[]): Promise<{ notasCredito: number; pagos: number }> {
  const [ncCxc, ncCxp, pagosCxc, pagosCxp] = await Promise.all([
    contarPorFacturaIds('factura_notas_credito', cxcIds),
    contarPorFacturaIds('proveedor_notas_credito', cxpIds),
    contarPorFacturaIds('pagos_factura', cxcIds),
    contarPorFacturaIds('pagos_proveedor', cxpIds),
  ]);

  return {
    notasCredito: ncCxc + ncCxp,
    pagos: pagosCxc + pagosCxp,
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

  const { count: proformasCount, error: proformasErr } = await supabase
    .from('proformas')
    .select('id', { count: 'exact', head: true })
    .eq('embarque_id', embarqueId)
    .is('deleted_at', null)
    .neq('estado_aprobacion', 'borrador')
    .eq('estado_proforma', 'pendiente');
  if (proformasErr) throw proformasErr;
  const proformas = proformasCount ?? 0;

  const tieneDependencias =
    cxcCount > 0 || cxpCount > 0 || notasCredito > 0 || pagos > 0 || proformas > 0;

  return {
    tieneDependencias,
    cxc: { count: cxcCount, facturas: cxc },
    cxp: { count: cxpCount, facturas: cxp },
    notasCredito,
    pagos,
    proformas,
  };
}

