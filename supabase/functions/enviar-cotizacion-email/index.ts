// supabase/functions/enviar-cotizacion-email/index.ts
// Orquesta el envío de una cotización por correo en 2 pasos: prepare + send.
// La lógica pesada vive en `handlers.ts`; este archivo solo valida JWT,
// carga la cotización y enruta a `handlePrepare` o `handleSend`.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { buildCors, handlePreflightStrict } from '../_shared/cors.ts';
import { handlePrepare, handleSend } from './handlers.ts';

function makeJson(cors: Record<string, string>) {
  return (data: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
}

type JsonFn = ReturnType<typeof makeJson>;

async function loadEnv(json: JsonFn): Promise<{ url: string; anon: string; service: string } | Response> {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json({ error: 'Server configuration error' }, 500);
  return { url, anon, service };
}

async function authenticateRequest(req: Request, url: string, anon: string, json: JsonFn) {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return { res: json({ error: 'Missing authorization' }, 401) };
  }
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) return { res: json({ error: 'Unauthorized' }, 401) };
  return { userId: userData.user.id, userEmail: userData.user.email ?? '' };
}

async function loadCotizacion(
  admin: ReturnType<typeof createClient>,
  cotizacionId: string,
  userId: string,
  json: JsonFn,
) {
  const { data: cot, error } = await admin
    .from('cotizaciones')
    .select('id, folio, organization_id, cliente_id, cliente_nombre, origen, destino, incoterm, modo, fecha_vigencia, estado, deleted_at')
    .eq('id', cotizacionId)
    .maybeSingle();
  if (error || !cot) return { res: json({ error: 'Cotización no encontrada' }, 404) };
  if (cot.deleted_at) return { res: json({ error: 'Cotización eliminada' }, 400) };

  const { data: membership } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', cot.organization_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!membership) return { res: json({ error: 'No tienes acceso a esta cotización' }, 403) };
  return { cot };
}

Deno.serve(wrapEdgeHandler("enviar-cotizacion-email", async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;

  const cors = buildCors(req);
  const json = makeJson(cors);

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const env = await loadEnv(json);
  if (env instanceof Response) return env;

  const auth = await authenticateRequest(req, env.url, env.anon, json);
  if ('res' in auth) return auth.res;

  const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const action = String(body.action ?? '');
  const cotizacionId = String(body.cotizacion_id ?? '');
  if (!cotizacionId) return json({ error: 'cotizacion_id requerido' }, 400);

  const loaded = await loadCotizacion(admin, cotizacionId, auth.userId, json);
  if ('res' in loaded) return loaded.res;
  const { cot } = loaded;

  const timestamp = Date.now();
  const pdfPath = `${cot.organization_id}/${cot.id}/${cot.folio}-${timestamp}.pdf`;

  if (action === 'prepare') return handlePrepare(admin, pdfPath, cors);
  if (action !== 'send') return json({ error: 'action inválida (prepare|send)' }, 400);

  return handleSend({
    admin,
    supabaseUrl: env.url,
    supabaseServiceKey: env.service,
    cot,
    userId: auth.userId,
    userEmail: auth.userEmail,
    body,
    timestamp,
    cors,
  });
}));
