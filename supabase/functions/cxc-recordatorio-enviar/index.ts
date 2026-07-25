import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';
import { buildCors, handlePreflightStrict } from '../_shared/cors.ts';
import { wrapEdgeHandler } from '../_shared/sentry.ts';
import { authenticate } from '../_shared/auth.ts';

const SITE_NAME = 'elogistix';
const FROM_DOMAIN = 'librecarga.com';

const BodySchema = z.object({
  factura_id: z.string().uuid(),
  nota: z.string().max(2000).optional(),
  canal: z.enum(['email']).default('email'),
  contacto_email: z.string().email().optional().nullable(),
});

function corsJson(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCors(req), 'Content-Type': 'application/json' },
  });
}

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

interface FacturaRecordatorio {
  id: string;
  organization_id: string;
  cliente_id: string;
  numero: string | null;
  serie: string | null;
  folio: string | null;
  cliente_nombre: string | null;
  total: number | null;
  saldo: number | null;
  moneda: string | null;
  fecha_vencimiento: string | null;
}

async function loadFactura(
  adminClient: SupabaseClient,
  facturaId: string,
): Promise<{ factura: FacturaRecordatorio | null; error: string | null }> {
  const { data, error } = await adminClient
    .from('facturas')
    .select('id, organization_id, cliente_id, numero, serie, folio, cliente_nombre, total, saldo, moneda, fecha_vencimiento')
    .eq('id', facturaId)
    .maybeSingle();
  if (error) return { factura: null, error: `Error al leer factura: ${error.message}` };
  return { factura: data as FacturaRecordatorio | null, error: null };
}

async function authorizeOrg(
  adminClient: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const [member, admin] = await Promise.all([
    adminClient.from('organization_members').select('id').eq('user_id', userId).eq('organization_id', organizationId).maybeSingle(),
    adminClient.from('user_roles').select('id').eq('user_id', userId).in('role', ['admin', 'super_admin']).maybeSingle(),
  ]);
  return !!member.data || !!admin.data;
}

async function resolveDestinatario(
  adminClient: SupabaseClient,
  clienteId: string,
  contactoEmail?: string | null,
): Promise<string | null> {
  if (contactoEmail) return contactoEmail;
  const { data } = await adminClient
    .from('contactos_cliente')
    .select('email')
    .eq('cliente_id', clienteId)
    .not('email', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.email ?? null;
}

async function loadPerfil(adminClient: SupabaseClient, userId: string) {
  const { data } = await adminClient.from('profiles').select('nombre, email, telefono').eq('id', userId).maybeSingle();
  return data;
}

async function loadOrgName(adminClient: SupabaseClient, organizationId: string) {
  const { data } = await adminClient.from('organizations').select('nombre').eq('id', organizationId).maybeSingle();
  return data?.nombre ?? null;
}

interface TemplateData {
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

function buildTemplateData(
  factura: FacturaRecordatorio,
  orgName: string | null,
  perfil: { nombre?: string | null; email?: string | null; telefono?: string | null } | null,
  nota?: string,
): TemplateData {
  const dias = diasEntre(factura.fecha_vencimiento, new Date().toISOString()) ?? 0;
  const saldo = factura.saldo ?? factura.total ?? 0;
  return {
    numero: factura.numero ?? `${factura.serie}-${factura.folio}`,
    cliente: factura.cliente_nombre ?? orgName ?? 'Cliente',
    contacto: '',
    saldo: formatCurrency(Number(saldo), factura.moneda ?? 'MXN'),
    moneda: factura.moneda ?? 'MXN',
    fechaVencimiento: formatDateMX(factura.fecha_vencimiento) ?? '',
    diasVencido: String(dias),
    mensaje: nota ?? '',
    enlacePago: '',
    ejecutivoNombre: perfil?.nombre ?? '',
    ejecutivoEmail: perfil?.email ?? '',
    ejecutivoTelefono: perfil?.telefono ?? '',
  };
}

async function sendRecordatorio(
  supabaseUrl: string,
  serviceRoleKey: string,
  destinatario: string,
  templateData: TemplateData,
): Promise<void> {
  const messageId = `recordatorio-${templateData.numero}-${Date.now()}`;
  const sendUrl = `${supabaseUrl}/functions/v1/send-transactional-email`;
  const sendResp = await fetch(sendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      templateName: 'recordatorio-cobranza',
      recipientEmail: destinatario,
      messageId,
      idempotencyKey: messageId,
      templateData,
    }),
  });
  const sendResult = await sendResp.json().catch(() => ({ error: 'No se pudo enviar el correo' }));
  if (!sendResp.ok || !sendResult.success) {
    throw new Error(`Error al enviar correo: ${sendResult.error ?? 'desconocido'}`);
  }
}

Deno.serve(wrapEdgeHandler('cxc-recordatorio-enviar', async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;

  try {
    const { userId, adminClient } = await authenticate(req);

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return corsJson({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400, req);
    }
    const { factura_id, nota, canal, contacto_email } = parsed.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: factura, error: facturaError } = await supabaseAdmin
      .from('facturas')
      .select('id, organization_id, cliente_id, numero, serie, folio, uuid_fiscal, total, saldo, moneda, fecha_vencimiento, dias_credito, estado, cliente_nombre, cliente_rfc')
      .eq('id', factura_id)
      .maybeSingle();
    if (facturaError) throw new Error(`500:Error al leer factura: ${facturaError.message}`);
    if (!factura) return corsJson({ error: 'Factura no encontrada' }, 404, req);

    const esAutorizado =
      (await supabaseAdmin.from('organization_members').select('id').eq('user_id', userId).eq('organization_id', factura.organization_id).maybeSingle()).data != null ||
      (await supabaseAdmin.from('user_roles').select('id').eq('user_id', userId).in('role', ['admin', 'super_admin']).maybeSingle()).data != null;
    if (!esAutorizado) {
      return corsJson({ error: 'No autorizado para esta organización' }, 403, req);
    }

    let destinatario = contacto_email;
    if (!destinatario) {
      const { data: contacto } = await supabaseAdmin
        .from('contactos_cliente')
        .select('email, nombre')
        .eq('cliente_id', factura.cliente_id)
        .not('email', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (contacto?.email) {
        destinatario = contacto.email;
      }
    }
    if (!destinatario) {
      return corsJson({ error: 'No hay correo de contacto para enviar el recordatorio' }, 400, req);
    }

    const { data: perfil } = await supabaseAdmin
      .from('profiles')
      .select('nombre, email, telefono')
      .eq('id', userId)
      .maybeSingle();

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('nombre')
      .eq('id', factura.organization_id)
      .maybeSingle();

    const fechaVencimiento = formatDateMX(factura.fecha_vencimiento);
    const diasVencido = diasEntre(factura.fecha_vencimiento, new Date().toISOString()) ?? 0;
    const saldo = factura.saldo ?? factura.total ?? 0;

    const { error: insertError } = await supabaseAdmin.from('factura_recordatorios').insert({
      factura_id: factura.id,
      organization_id: factura.organization_id,
      enviado_por: userId,
      canal,
      nota: nota ?? null,
    });
    if (insertError) throw new Error(`500:Error al guardar recordatorio: ${insertError.message}`);

    const messageId = `recordatorio-${factura.id}-${Date.now()}`;
    const idempotencyKey = messageId;
    const templateData = {
      numero: factura.numero ?? `${factura.serie}-${factura.folio}`,
      cliente: factura.cliente_nombre ?? org?.nombre ?? 'Cliente',
      contacto: '',
      saldo: formatCurrency(Number(saldo), factura.moneda ?? 'MXN'),
      moneda: factura.moneda ?? 'MXN',
      fechaVencimiento: fechaVencimiento ?? '',
      diasVencido: String(diasVencido),
      mensaje: nota ?? '',
      enlacePago: '',
      ejecutivoNombre: perfil?.nombre ?? '',
      ejecutivoEmail: perfil?.email ?? '',
      ejecutivoTelefono: perfil?.telefono ?? '',
    };

    const sendUrl = `${supabaseUrl}/functions/v1/send-transactional-email`;
    const sendResp = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateName: 'recordatorio-cobranza',
        recipientEmail: destinatario,
        messageId,
        idempotencyKey,
        templateData,
      }),
    });

    const sendResult = await sendResp.json().catch(() => ({ error: 'No se pudo enviar el correo' }));
    if (!sendResp.ok || !sendResult.success) {
      console.error('send-transactional-email falló', sendResult);
      throw new Error(`500:Error al enviar correo: ${sendResult.error ?? 'desconocido'}`);
    }

    return corsJson({ ok: true, enviado_a: destinatario }, 200, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('401:')) return corsJson({ error: msg.slice(4) }, 401, req);
    if (msg.startsWith('500:')) return corsJson({ error: msg.slice(4) }, 500, req);
    console.error('cxc-recordatorio-enviar error', err);
    return corsJson({ error: 'Error interno del servidor' }, 500, req);
  }
}));
