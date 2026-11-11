import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
import { wrapEdgeHandler, captureEdgeException } from '../_shared/sentry.ts';
import { buildCors, handlePreflightStrict } from '../_shared/cors.ts';
import { enviarEmailPlantilla } from '../_shared/enviarEmailPlantilla.ts';
import { jsonResponse } from '../_shared/response.ts';

const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://elogistix.lovable.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Destinatario { email: string; nombre?: string }
interface Recipient extends Destinatario { tipo: 'to' | 'cc' }

function normalizarEmail(valor: unknown): string | null {
  const email = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function solicitud(body: Record<string, unknown>) {
  const recipients = new Map<string, Recipient>();
  for (const d of Array.isArray(body.destinatarios) ? body.destinatarios : []) {
    const email = normalizarEmail(d?.email);
    if (email && !recipients.has(email)) {
      const nombre = typeof d.nombre === 'string' ? d.nombre.trim() : '';
      recipients.set(email, { email, tipo: 'to', ...(nombre ? { nombre } : {}) });
    }
  }
  const destinatarios = [...recipients.values()].map(({ email, nombre }) => ({ email, nombre }));
  if (!destinatarios.length) return null;

  const cc: string[] = [];
  for (const valor of Array.isArray(body.cc) ? body.cc : []) {
    const email = normalizarEmail(valor);
    if (!email || recipients.has(email)) continue;
    cc.push(email);
    recipients.set(email, { email, tipo: 'cc' });
  }

  return {
    destinatarios, cc, recipients: [...recipients.values()],
    asunto: typeof body.asunto === 'string' ? body.asunto.replace(/[\r\n]+/g, ' ').trim() : '',
    mensaje: typeof body.mensaje === 'string' ? body.mensaje : '',
    dias_vigencia: Number.isInteger(body.dias_vigencia) && Number(body.dias_vigencia) > 0
      ? Number(body.dias_vigencia) : 30,
  };
}

interface Contenido {
  token: string;
  expira: string;
  enlace: string;
  numero: string | null;
  cliente: string | null;
  expediente: string | null;
  total_mxn: number | null;
  total_usd: number | null;
}

type Reserva =
  | { estado: 'reservado'; contenido: Contenido }
  | { estado: 'confirmado'; resultado: Record<string, unknown> }
  | { estado: 'en_proceso' | 'sin_acceso' | 'no_encontrada' | 'cancelada' | 'intento_distinto' };

function datosPlantilla(contenido: Contenido, entrada: NonNullable<ReturnType<typeof solicitud>>) {
  const usd = Number(contenido.total_usd ?? 0);
  const moneda = usd > 0 ? 'USD' : 'MXN';
  const total = new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda })
    .format(usd > 0 ? usd : Number(contenido.total_mxn ?? 0));
  const vigencia = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(contenido.expira));

  return {
    numero: contenido.numero, cliente: contenido.cliente, expediente: contenido.expediente,
    total, moneda, asunto: entrada.asunto, mensaje: entrada.mensaje, vigencia, enlacePortal: contenido.enlace,
  };
}

async function entregar(
  admin: SupabaseClient,
  intento: string,
  proformaId: string,
  contenido: Contenido,
  entrada: NonNullable<ReturnType<typeof solicitud>>,
): Promise<void> {
  const claves = entrada.recipients.map((_, indice) => 'proforma:' + intento + ':' + (indice + 1));
  const { data, error } = await admin.from('email_send_log')
    .select('message_id').in('message_id', claves).in('status', ['sent', 'suppressed']);
  if (error) throw error;

  const resueltos = new Set((data ?? []).map((registro) => registro.message_id));
  const templateData = datosPlantilla(contenido, entrada);
  for (const [indice, recipient] of entrada.recipients.entries()) {
    const clave = claves[indice];
    if (resueltos.has(clave)) continue;
    const { data: vigente, error: errorVigencia } = await admin.from('proformas')
      .select('id').eq('id', proformaId).eq('token_publico', contenido.token)
      .is('deleted_at', null).neq('estado_proforma', 'cancelada')
      .gt('token_expira_at', new Date().toISOString()).maybeSingle();
    if (errorVigencia) throw errorVigencia;
    if (!vigente) return;

    const resultado = await enviarEmailPlantilla(admin, {
      templateName: 'proforma-enviada',
      recipientEmail: recipient.email,
      idempotencyKey: clave,
      messageId: clave,
      templateData: { ...templateData, contacto: recipient.nombre },
    });
    if (!resultado.ok && !resultado.suprimido) {
      await captureEdgeException(new Error('Entrega de proforma sin confirmación'), {
        fn: 'enviar-proforma-email', extra: { phase: 'send', recipient_type: recipient.tipo },
      });
    }
  }
}

Deno.serve(wrapEdgeHandler('enviar-proforma-email', async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const responder = (body: unknown, status = 200) => jsonResponse(body, status, cors);
  if (req.method !== 'POST') return responder({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return responder({ error: 'Server configuration error' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return responder({ error: 'Missing authorization' }, 401);
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return responder({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return responder({ error: 'Invalid JSON' }, 400);
  const proformaId = body.proforma_id;
  if (typeof proformaId !== 'string' || !UUID.test(proformaId)) return responder({ error: 'proforma_id inválido' }, 400);
  if (body.intento_id != null && (typeof body.intento_id !== 'string' || !UUID.test(body.intento_id))) {
    return responder({ error: 'intento_id inválido' }, 400);
  }
  const entrada = solicitud(body);
  if (!entrada) return responder({ error: 'Al menos un destinatario válido es requerido' }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const intento = body.intento_id ?? crypto.randomUUID();
  const reserva = crypto.randomUUID();
  const { data, error } = await admin.rpc('reservar_proforma_email', {
    p_proforma_id: proformaId, p_usuario_id: user.id, p_intento: intento, p_reserva: reserva,
    p_solicitud: entrada, p_portal_base: APP_URL,
  });
  if (error) throw error;

  const reservada = data as Reserva;
  if (reservada.estado === 'confirmado') return responder(reservada.resultado);
  if (reservada.estado === 'no_encontrada') return responder({ error: 'Proforma no encontrada' }, 404);
  if (reservada.estado === 'sin_acceso') return responder({ error: 'No tienes acceso a esta proforma' }, 403);
  if (reservada.estado === 'cancelada') {
    return responder({ error: 'LC_PROFORMA_CANCELADA: crea una nueva proforma para enviar al cliente.' }, 409);
  }
  if (reservada.estado === 'intento_distinto') {
    return responder({ error: 'El intento corresponde a otro envío.' }, 409);
  }

  const adquirido = reservada.estado === 'reservado';
  if (adquirido) {
    try {
      await entregar(admin, intento, proformaId, reservada.contenido, entrada);
    } catch (e) {
      await captureEdgeException(e, { fn: 'enviar-proforma-email', extra: { phase: 'send' } });
    }
  }

  const { data: resultado, error: errorFinal } = await admin.rpc('finalizar_proforma_email', {
    p_intento: intento, p_usuario_id: user.id, p_reserva: adquirido ? reserva : null,
  });
  if (errorFinal) throw errorFinal;
  if (resultado.estado === 'sin_acceso') return responder({ error: 'No tienes acceso a esta proforma' }, 403);
  return responder(resultado);
}));
