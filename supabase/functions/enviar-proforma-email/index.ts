// supabase/functions/enviar-proforma-email/index.ts
// Envía una proforma al cliente por email con enlace al portal público.
// Genera un token si no existe, encola el email vía send-transactional-email
// y registra el envío en `proforma_envios`.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
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

interface Recipient { email: string; nombre?: string; tipo: 'to' | 'cc' }
interface EnvioResultado { email: string; tipo: string; ok: boolean; error?: string }

async function asegurarToken(
  admin: ReturnType<typeof createClient>,
  proformaId: string,
  tokenActual: string | null,
  expiraActual: string | null,
  diasVigencia: number,
): Promise<{ token: string; expira: string } | { error: string }> {
  const ahora = Date.now();
  const vigente = tokenActual && expiraActual && new Date(expiraActual).getTime() >= ahora;
  if (vigente) return { token: tokenActual!, expira: expiraActual! };
  const nuevoToken = crypto.randomUUID();
  const nuevaExp = new Date(ahora + diasVigencia * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin
    .from('proformas')
    .update({ token_publico: nuevoToken, token_expira_at: nuevaExp })
    .eq('id', proformaId);
  if (error) {
    await captureEdgeException(error, { fn: 'enviar-proforma-email', extra: { phase: 'token' } });
    return { error: error.message };
  }
  return { token: nuevoToken, expira: nuevaExp };
}

interface EnvioContexto {
  url: string;
  service: string;
  proformaId: string;
  timestamp: number;
  templateData: Record<string, unknown>;
}

async function enviarDestinatario(ctx: EnvioContexto, r: Recipient): Promise<EnvioResultado> {
  const idem = `proforma-${ctx.proformaId}-${ctx.timestamp}-${r.email}`;
  try {
    const resp = await fetch(`${ctx.url}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.service}` },
      body: JSON.stringify({
        templateName: 'proforma-enviada',
        recipientEmail: r.email,
        idempotencyKey: idem,
        templateData: { ...ctx.templateData, contacto: r.nombre },
      }),
    });
    const out = await resp.json().catch(() => ({}));
    const ok = resp.ok && (out?.success !== false || out?.queued === true);
    return { email: r.email, tipo: r.tipo, ok, error: ok ? undefined : (out?.error ?? `HTTP ${resp.status}`) };
  } catch (e) {
    await captureEdgeException(e, { fn: 'enviar-proforma-email', extra: { phase: 'send', recipient_type: r.tipo } });
    return { email: r.email, tipo: r.tipo, ok: false, error: (e as Error).message };
  }
}

interface EntornoEdge { url: string; anon: string; service: string }

function leerEntorno(): EntornoEdge | null {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return null;
  return { url, anon, service };
}

async function autenticarUsuario(env: EntornoEdge, authHeader: string) {
  const userClient = createClient(env.url, env.anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? '' };
}

interface EntradaValidada {
  proformaId: string;
  validos: Destinatario[];
  ccEmails: string[];
  asunto: string;
  mensaje: string;
  diasVigencia: number;
}

function validarEntrada(body: Record<string, unknown>): EntradaValidada | { error: string } {
  const proformaId = String(body.proforma_id ?? '');
  if (!proformaId) return { error: 'proforma_id requerido' };
  const destinatarios = Array.isArray(body.destinatarios) ? (body.destinatarios as Destinatario[]) : [];
  const validos = destinatarios.filter((d) => d && isEmail(d.email));
  if (validos.length === 0) return { error: 'Al menos un destinatario válido es requerido' };
  const ccEmails = Array.isArray(body.cc) ? (body.cc as string[]).filter(isEmail) : [];
  return {
    proformaId,
    validos,
    ccEmails,
    asunto: typeof body.asunto === 'string' ? body.asunto : '',
    mensaje: typeof body.mensaje === 'string' ? body.mensaje : '',
    diasVigencia: Number.isFinite(body.dias_vigencia) ? Number(body.dias_vigencia) : 30,
  };
}

interface ProformaRow {
  id: string; numero: string | null; cliente_nombre: string | null; expediente: string | null;
  moneda: string | null; total: number | null; organization_id: string;
  token_publico: string | null; token_expira_at: string | null;
}

interface RegistrarEnvioParams {
  proformaId: string; prof: ProformaRow; userId: string; userEmail: string;
  validos: Destinatario[]; ccEmails: string[]; asunto: string; mensaje: string;
  enlacePortal: string; estado: string; anyOk: boolean; anyFail: boolean;
  resultados: EnvioResultado[];
}

async function registrarEnvio(admin: SupabaseClient, params: RegistrarEnvioParams) {
  const { data: envio, error: envioErr } = await admin
    .from('proforma_envios')
    .insert({
      proforma_id: params.proformaId,
      organization_id: params.prof.organization_id,
      enviado_por: params.userId,
      destinatarios: params.validos,
      cc: params.ccEmails,
      asunto: params.asunto,
      mensaje: params.mensaje,
      pdf_link_publico: params.enlacePortal,
      estado: params.estado,
      error: params.anyFail ? JSON.stringify(params.resultados.filter((r) => !r.ok)) : null,
    })
    .select('id')
    .single();
  if (envioErr) console.error('proforma_envios insert failed', envioErr);

  if (params.anyOk) {
    await admin.from('proformas')
      .update({ enviada_at: new Date().toISOString(), enviada_por: params.userId, ultimo_envio_email: params.validos[0]?.email ?? null })
      .eq('id', params.proformaId);
  }

  await admin.from('bitacora_actividad').insert({
    organization_id: params.prof.organization_id, usuario_id: params.userId, usuario_email: params.userEmail,
    modulo: 'proformas',
    accion: params.anyOk ? 'proforma_enviada_email' : 'proforma_envio_email_fallido',
    entidad_id: params.proformaId, entidad_nombre: params.prof.numero ?? '',
    detalles: { envio_id: envio?.id ?? null, destinatarios: params.validos.map((d) => d.email), cc: params.ccEmails, resultados: params.resultados, enlace_portal: params.enlacePortal },
  }).then(() => null, () => null);

  return envio?.id ?? null;
}

async function cargarProforma(admin: SupabaseClient, proformaId: string): Promise<ProformaRow | null> {
  const { data, error } = await admin
    .from('proformas')
    .select('id, numero, cliente_nombre, expediente, moneda, total, organization_id, token_publico, token_expira_at')
    .eq('id', proformaId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ProformaRow;
}

async function usuarioTieneAcceso(admin: SupabaseClient, orgId: string, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

async function despacharCorreos(
  ctx: EnvioContexto, recipients: Recipient[],
): Promise<{ resultados: EnvioResultado[]; estado: string; anyOk: boolean; anyFail: boolean }> {
  const resultados: EnvioResultado[] = [];
  for (const r of recipients) {
    resultados.push(await enviarDestinatario(ctx, r));
  }
  const anyOk = resultados.some((r) => r.ok);
  const anyFail = resultados.some((r) => !r.ok);
  const estado = anyOk && anyFail ? 'parcial' : anyOk ? 'enviado' : 'fallido';
  return { resultados, estado, anyOk, anyFail };
}

Deno.serve(wrapEdgeHandler('enviar-proforma-email', async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;

  const cors = buildCors(req);
  if (req.method !== 'POST') return json(cors, { error: 'Method not allowed' }, 405);

  const env = leerEntorno();
  if (!env) return json(cors, { error: 'Server configuration error' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return json(cors, { error: 'Missing authorization' }, 401);
  }
  const user = await autenticarUsuario(env, authHeader);
  if (!user) return json(cors, { error: 'Unauthorized' }, 401);

  const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(cors, { error: 'Invalid JSON' }, 400); }

  const entrada = validarEntrada(body);
  if ('error' in entrada) return json(cors, { error: entrada.error }, 400);

  const { data: prof, error: profErr } = await admin
    .from('proformas')
    .select('id, numero, cliente_nombre, expediente, moneda, total, organization_id, token_publico, token_expira_at')
    .eq('id', entrada.proformaId)
    .maybeSingle();
  if (profErr || !prof) return json(cors, { error: 'Proforma no encontrada' }, 404);

  const { data: mem } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', prof.organization_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!mem) return json(cors, { error: 'No tienes acceso a esta proforma' }, 403);

  const tokenResult = await asegurarToken(
    admin,
    entrada.proformaId,
    prof.token_publico as string | null,
    prof.token_expira_at as string | null,
    entrada.diasVigencia,
  );
  if ('error' in tokenResult) return json(cors, { error: 'No se pudo generar token', detail: tokenResult.error }, 500);
  const { token, expira: tokenExpira } = tokenResult;

  const enlacePortal = `${APP_URL}/portal/proformas/${token}`;
  const timestamp = Date.now();

  const recipients: Recipient[] = [
    ...entrada.validos.map((d) => ({ email: d.email, nombre: d.nombre, tipo: 'to' as const })),
    ...entrada.ccEmails.map((e) => ({ email: e, tipo: 'cc' as const })),
  ];

  const templateData = {
    numero: prof.numero,
    cliente: prof.cliente_nombre,
    expediente: prof.expediente,
    moneda: prof.moneda,
    total: formatoMoneda(prof.total as number | null, (prof.moneda as string) ?? 'MXN'),
    mensaje: entrada.mensaje,
    vigencia: formatoFechaMx(tokenExpira),
    enlacePortal,
  };

  const ctx: EnvioContexto = { url: env.url, service: env.service, proformaId: entrada.proformaId, timestamp, templateData };
  const resultados: EnvioResultado[] = [];
  for (const r of recipients) {
    resultados.push(await enviarDestinatario(ctx, r));
  }

  const anyOk = resultados.some((r) => r.ok);
  const anyFail = resultados.some((r) => !r.ok);
  const estado = anyOk && anyFail ? 'parcial' : anyOk ? 'enviado' : 'fallido';

  const envioId = await registrarEnvio(admin, {
    proformaId: entrada.proformaId, prof, userId: user.id, userEmail: user.email,
    validos: entrada.validos, ccEmails: entrada.ccEmails, asunto: entrada.asunto, mensaje: entrada.mensaje,
    enlacePortal, estado, anyOk, anyFail, resultados,
  });

  return json(cors, {
    success: anyOk,
    estado,
    envio_id: envioId,
    enlace_portal: enlacePortal,
    token_expira_at: tokenExpira,
    resultados,
  });
}));
