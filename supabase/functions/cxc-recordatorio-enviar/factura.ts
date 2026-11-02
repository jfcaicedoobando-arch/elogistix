import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

function formatCurrency(value: number, moneda: string): string {
  return `${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;
}

function formatDateMX(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function diasEntre(isoVencimiento?: string | null, isoHoy?: string | null): number | null {
  if (!isoVencimiento) return null;
  const venc = new Date(isoVencimiento);
  const hoy = isoHoy ? new Date(isoHoy) : new Date();
  if (Number.isNaN(venc.getTime())) return null;
  return Math.floor((hoy.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
}

export interface FacturaRecordatorio {
  id: string;
  organization_id: string;
  cliente_id: string;
  numero: string | null;
  serie: string | null;
  cliente_nombre: string | null;
  total: number | null;
  saldo: number | null;
  moneda: string | null;
  fecha_vencimiento: string | null;
}

export async function loadFactura(
  adminClient: SupabaseClient,
  facturaId: string,
): Promise<{ factura: FacturaRecordatorio | null; error: string | null }> {
  // A8 (v13.469.0): `facturas` no tiene columna `saldo`; se calcula con la RPC
  // `saldo_factura` (pagos aplicados y notas de crédito vigentes).
  const { data, error } = await adminClient
    .from('facturas')
    // `facturas` no tiene columna `folio` (sólo `numero`, `serie` y `folio_fiscal`).
    .select('id, organization_id, cliente_id, numero, serie, cliente_nombre, total, moneda, fecha_vencimiento')
    .eq('id', facturaId)
    .maybeSingle();
  if (error) return { factura: null, error: `Error al leer factura: ${error.message}` };
  if (!data) return { factura: null, error: null };

  return { factura: { ...(data as Omit<FacturaRecordatorio, 'saldo'>), saldo: null }, error: null };
}

/** Se consulta sólo después de autorizar la organización de la factura. */
export async function loadSaldoFactura(adminClient: SupabaseClient, facturaId: string): Promise<number> {
  const { data, error } = await adminClient.rpc('saldo_factura', { p_factura_id: facturaId });
  if (error) throw new Error('No se pudo consultar el saldo');
  return Number(data ?? 0);
}

export async function loadPerfil(adminClient: SupabaseClient, userId: string) {
  const { data } = await adminClient.from('profiles').select('nombre, email, telefono').eq('id', userId).maybeSingle();
  return data;
}

export async function loadOrgName(adminClient: SupabaseClient, organizationId: string) {
  const { data } = await adminClient.from('organizations').select('nombre').eq('id', organizationId).maybeSingle();
  return data?.nombre ?? null;
}

export interface TemplateData {
  numero: string;
  cliente: string;
  contacto: string;
  saldo: string;
  moneda: string;
  fechaVencimiento: string;
  diasVencido: string;
  mensaje: string;
  enlacePago: string;
  ejecutivoNombre: string;
  ejecutivoEmail: string;
  ejecutivoTelefono: string;
}

/** `facturas` no tiene `folio`: se muestra `numero` y, si falta, la serie. */
function folioMostrado(factura: FacturaRecordatorio): string {
  if (factura.numero) return factura.numero;
  return factura.serie ?? 'sin folio';
}

export function buildTemplateData(
  factura: FacturaRecordatorio,
  orgName: string | null,
  perfil: { nombre?: string | null; email?: string | null; telefono?: string | null } | null,
  nota?: string,
): TemplateData {
  const dias = diasEntre(factura.fecha_vencimiento, new Date().toISOString()) ?? 0;
  const saldo = factura.saldo ?? factura.total ?? 0;
  const moneda = factura.moneda ?? 'MXN';
  const numero = folioMostrado(factura);
  const cliente = factura.cliente_nombre ?? orgName ?? 'Cliente';
  return {
    numero,
    cliente,
    contacto: '',
    saldo: formatCurrency(Number(saldo), moneda),
    moneda,
    fechaVencimiento: formatDateMX(factura.fecha_vencimiento) ?? '',
    diasVencido: String(dias),
    mensaje: nota ?? '',
    enlacePago: '',
    ejecutivoNombre: perfil?.nombre ?? '',
    ejecutivoEmail: perfil?.email ?? '',
    ejecutivoTelefono: perfil?.telefono ?? '',
  };
}
