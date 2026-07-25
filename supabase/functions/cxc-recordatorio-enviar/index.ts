import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';
import { buildCors, handlePreflightStrict } from '../_shared/cors.ts';
import { wrapEdgeHandler } from '../_shared/sentry.ts';
import { authenticate } from '../_shared/auth.ts';

const SITE_NAME = 'elogistix';
const FROM_DOMAIN = 'librecarga.com';
const SENDER_DOMAIN = 'notify.librecarga.com';

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
  const symbol = moneda === 'USD' ? '$' : '$';
  const decimals = moneda === 'USD' ? 2 : 2;
  return `${symbol} ${value.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${moneda}`;
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
  const diffMs = hoy.getTime() - venc.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
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

    const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: destinatario,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: `${diasVencido > 0 ? 'Factura vencida' : 'Recordatorio de pago'} — ${templateData.numero}`,
        html: '',
        text: '',
        purpose: 'transactional',
        label: 'recordatorio-cobranza',
        idempotency_key: idempotencyKey,
        template_name: 'recordatorio-cobranza',
        template_data: templateData,
        queued_at: new Date().toISOString(),
      },
    });
    if (enqueueError) throw new Error(`500:Error al encolar correo: ${enqueueError.message}`);

    return corsJson({ ok: true, enviado_a: destinatario }, 200, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('401:')) return corsJson({ error: msg.slice(4) }, 401, req);
    if (msg.startsWith('500:')) return corsJson({ error: msg.slice(4) }, 500, req);
    console.error('cxc-recordatorio-enviar error', err);
    return corsJson({ error: 'Error interno del servidor' }, 500, req);
  }
}));
