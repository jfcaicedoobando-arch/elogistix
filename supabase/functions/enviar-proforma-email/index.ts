// supabase/functions/enviar-proforma-email/index.ts
// Envía una proforma al cliente por email con enlace al portal público.
// Genera un token si no existe, encola el email vía send-transactional-email
// y registra el envío en `proforma_envios`.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { wrapEdgeHandler, captureEdgeException } from '../_shared/sentry.ts';
import { buildCors, handlePreflightStrict } from '../_shared/cors.ts';

const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://elogistix.lovable.app';

function json(cors: Record<string, string>, data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

interface Destinatario { email: string; nombre?: string }

function isEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function formatoFechaMx(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
  } catch { return ''; }
}

function formatoMoneda(v: number | null | undefined, moneda: string): string {
  if (v == null) return '';
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN' }).format(Number(v));
  } catch { return `${v} ${moneda}`; }
}

Deno.serve(wrapEdgeHandler('enviar-proforma-email', async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;

  const cors = buildCors(req);
  if (req.method !== 'POST') return json(cors, { error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json(cors, { error: 'Server configuration error' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return json(cors, { error: 'Missing authorization' }, 401);
  }
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(cors, { error: 'Unauthorized' }, 401);
  const userId = userData.user.id;
  const userEmail = userData.user.email ?? '';

  const admin = createClient(url, service, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(cors, { error: 'Invalid JSON' }, 400); }

  const proformaId = String(body.proforma_id ?? '');
  if (!proformaId) return json(cors, { error: 'proforma_id requerido' }, 400);

  const destinatarios = Array.isArray(body.destinatarios) ? (body.destinatarios as Destinatario[]) : [];
  const validos = destinatarios.filter((d) => d && isEmail(d.email));
  const ccEmails = Array.isArray(body.cc) ? (body.cc as string[]).filter(isEmail) : [];
  if (validos.length === 0) return json(cors, { error: 'Al menos un destinatario válido es requerido' }, 400);

  const asunto = typeof body.asunto === 'string' ? body.asunto : '';
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje : '';
  const diasVigencia = Number.isFinite(body.dias_vigencia) ? Number(body.dias_vigencia) : 30;

  // Cargar proforma
  const { data: prof, error: profErr } = await admin
    .from('proformas')
    .select('id, numero, cliente_nombre, expediente, moneda, total, organization_id, token_publico, token_expira_at')
    .eq('id', proformaId)
    .maybeSingle();
  if (profErr || !prof) return json(cors, { error: 'Proforma no encontrada' }, 404);

  // Verificar acceso a la org
  const { data: mem } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', prof.organization_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!mem) return json(cors, { error: 'No tienes acceso a esta proforma' }, 403);

  // Generar token si no existe o si ya expiró
  let token = prof.token_publico as string | null;
  let tokenExpira = prof.token_expira_at as string | null;
  const ahora = Date.now();
  const necesitaToken = !token || !tokenExpira || new Date(tokenExpira).getTime() < ahora;
  if (necesitaToken) {
    const nuevoToken = crypto.randomUUID();
    const nuevaExp = new Date(ahora + diasVigencia * 24 * 60 * 60 * 1000).toISOString();
    const { error: tokErr } = await admin
      .from('proformas')
      .update({ token_publico: nuevoToken, token_expira_at: nuevaExp })
      .eq('id', proformaId);
    if (tokErr) {
      await captureEdgeException(tokErr, { fn: 'enviar-proforma-email', extra: { phase: 'token' } });
      return json(cors, { error: 'No se pudo generar token', detail: tokErr.message }, 500);
    }
    token = nuevoToken;
    tokenExpira = nuevaExp;
  }

  const enlacePortal = `${APP_URL}/portal/proformas/${token}`;
  const timestamp = Date.now();

  // Enviar por cada destinatario
  const resultados: { email: string; tipo: string; ok: boolean; error?: string }[] = [];
  const recipients = [
    ...validos.map((d) => ({ email: d.email, nombre: d.nombre, tipo: 'to' as const })),
    ...ccEmails.map((e) => ({ email: e, tipo: 'cc' as const })),
  ];

  for (const r of recipients) {
    const idem = `proforma-${proformaId}-${timestamp}-${r.email}`;
    try {
      const resp = await fetch(`${url}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${service}` },
        body: JSON.stringify({
          templateName: 'proforma-enviada',
          recipientEmail: r.email,
          idempotencyKey: idem,
          templateData: {
            numero: prof.numero,
            cliente: prof.cliente_nombre,
            contacto: r.nombre,
            expediente: prof.expediente,
            moneda: prof.moneda,
            total: formatoMoneda(prof.total as number | null, (prof.moneda as string) ?? 'MXN'),
            mensaje,
            vigencia: formatoFechaMx(tokenExpira),
            enlacePortal,
          },
        }),
      });
      const out = await resp.json().catch(() => ({}));
      const ok = resp.ok && (out?.success !== false || out?.queued === true);
      resultados.push({ email: r.email, tipo: r.tipo, ok, error: ok ? undefined : (out?.error ?? `HTTP ${resp.status}`) });
    } catch (e) {
      await captureEdgeException(e, { fn: 'enviar-proforma-email', extra: { phase: 'send', recipient_type: r.tipo } });
      resultados.push({ email: r.email, tipo: r.tipo, ok: false, error: (e as Error).message });
    }
  }

  const anyOk = resultados.some((r) => r.ok);
  const anyFail = resultados.some((r) => !r.ok);
  const estado = anyOk && anyFail ? 'parcial' : anyOk ? 'enviado' : 'fallido';

  // Persistir envío
  const { data: envio, error: envioErr } = await admin
    .from('proforma_envios')
    .insert({
      proforma_id: proformaId,
      organization_id: prof.organization_id,
      enviado_por: userId,
      destinatarios: validos,
      cc: ccEmails,
      asunto,
      mensaje,
      pdf_link_publico: enlacePortal,
      estado,
      error: anyFail ? JSON.stringify(resultados.filter((r) => !r.ok)) : null,
    })
    .select('id')
    .single();
  if (envioErr) console.error('proforma_envios insert failed', envioErr);

  if (anyOk) {
    await admin.from('proformas')
      .update({ enviada_at: new Date().toISOString(), enviada_por: userId, ultimo_envio_email: validos[0]?.email ?? null })
      .eq('id', proformaId);
  }

  await admin.from('bitacora_actividad').insert({
    organization_id: prof.organization_id, usuario_id: userId, usuario_email: userEmail,
    modulo: 'proformas',
    accion: anyOk ? 'proforma_enviada_email' : 'proforma_envio_email_fallido',
    entidad_id: proformaId, entidad_nombre: prof.numero ?? '',
    detalles: { envio_id: envio?.id ?? null, destinatarios: validos.map((d) => d.email), cc: ccEmails, resultados, enlace_portal: enlacePortal },
  }).then(() => null, () => null);

  return json(cors, {
    success: anyOk,
    estado,
    envio_id: envio?.id ?? null,
    enlace_portal: enlacePortal,
    token_expira_at: tokenExpira,
    resultados,
  });
}));
