// supabase/functions/enviar-cotizacion-email/index.ts
// Orquesta el envío de una cotización por correo:
//  1. Valida JWT + permisos (miembro de la org dueña de la cotización).
//  2. Genera signed upload URL (el cliente sube el PDF ya generado).
//  3. Crea signed download URL (válido 30 días) del PDF subido.
//  4. Invoca send-transactional-email por cada destinatario (TO + CC).
//  5. Inserta fila en cotizacion_envios y bitacora_actividad.
//  6. Transiciona la cotización a "Enviada" si estaba en "Borrador".
//
// El flujo es en 2 pasos: el cliente llama action="prepare" para obtener
// signed upload URL, sube el PDF, luego llama action="send" con el path.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://elogistix.lovable.app';
const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 días

interface Destinatario {
  email: string;
  nombre?: string;
  contacto_id?: string;
}

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return json({ error: 'Server configuration error' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'Missing authorization' }, 401);
  }

  // Cliente con el JWT del usuario para validar identidad
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  // Cliente service-role para operaciones privilegiadas
  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const action = String(body.action ?? '');
  const cotizacionId = String(body.cotizacion_id ?? '');
  if (!cotizacionId) return json({ error: 'cotizacion_id requerido' }, 400);

  // Cargar cotización y verificar membresía
  const { data: cot, error: cotErr } = await admin
    .from('cotizaciones')
    .select('id, folio, organization_id, cliente_nombre, origen, destino, incoterm, modo, fecha_vigencia, estado, deleted_at')
    .eq('id', cotizacionId)
    .maybeSingle();
  if (cotErr || !cot) return json({ error: 'Cotización no encontrada' }, 404);
  if (cot.deleted_at) return json({ error: 'Cotización eliminada' }, 400);

  const { data: membership } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', cot.organization_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!membership) return json({ error: 'No tienes acceso a esta cotización' }, 403);

  const timestamp = Date.now();
  const pdfPath = `${cot.organization_id}/${cot.id}/${cot.folio}-${timestamp}.pdf`;

  // ─── ACTION: prepare ───
  // Devuelve signed upload URL para que el cliente suba el PDF directamente.
  if (action === 'prepare') {
    const { data: upload, error: upErr } = await admin
      .storage.from('cotizaciones-pdf')
      .createSignedUploadUrl(pdfPath);
    if (upErr || !upload) return json({ error: 'No se pudo preparar la subida', detail: upErr?.message }, 500);
    return json({
      upload_url: upload.signedUrl,
      upload_token: upload.token,
      path: pdfPath,
    });
  }

  // ─── ACTION: send ───
  if (action !== 'send') return json({ error: 'action inválida (prepare|send)' }, 400);

  const destinatarios = Array.isArray(body.destinatarios) ? (body.destinatarios as Destinatario[]) : [];
  const ccEmails = Array.isArray(body.cc) ? (body.cc as string[]).filter(isEmail) : [];
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje : '';
  const asunto = typeof body.asunto === 'string' ? body.asunto : '';
  const pdfStoragePath = typeof body.pdf_path === 'string' ? body.pdf_path : '';
  const marcarEnviada = body.marcar_enviada !== false;
  const totales = (body.totales ?? {}) as { mxn?: string; usd?: string };
  const ejecutivo = (body.ejecutivo ?? {}) as { nombre?: string; email?: string; telefono?: string };

  const validRecipients = destinatarios.filter((d) => d?.email && isEmail(d.email));
  if (validRecipients.length === 0) return json({ error: 'Al menos un destinatario válido es requerido' }, 400);
  if (!pdfStoragePath) return json({ error: 'pdf_path requerido (sube el PDF primero con action=prepare)' }, 400);

  // Generar signed URL (30 días) para el PDF
  const { data: signed, error: signErr } = await admin
    .storage.from('cotizaciones-pdf')
    .createSignedUrl(pdfStoragePath, SIGNED_URL_TTL);
  if (signErr || !signed) {
    return json({ error: 'No se pudo generar link al PDF', detail: signErr?.message }, 500);
  }
  const pdfLink = signed.signedUrl;
  const enlacePortal = `${APP_URL}/cotizaciones/${cot.id}`;

  const templateData = {
    folio: cot.folio,
    cliente: cot.cliente_nombre,
    origen: cot.origen,
    destino: cot.destino,
    incoterm: cot.incoterm,
    modo: cot.modo,
    vigencia: cot.fecha_vigencia ?? undefined,
    totalMxn: totales.mxn,
    totalUsd: totales.usd,
    mensaje,
    enlacePortal,
    enlacePdf: pdfLink,
    ejecutivoNombre: ejecutivo.nombre,
    ejecutivoEmail: ejecutivo.email,
    ejecutivoTelefono: ejecutivo.telefono,
  };

  // Enviar a cada destinatario (TO) + cada CC, uno por uno (send-transactional-email es por email)
  const allRecipients: { email: string; nombre?: string; tipo: 'to' | 'cc' }[] = [
    ...validRecipients.map((d) => ({ email: d.email, nombre: d.nombre, tipo: 'to' as const })),
    ...ccEmails.map((e) => ({ email: e, tipo: 'cc' as const })),
  ];

  const resultados: { email: string; tipo: string; ok: boolean; error?: string }[] = [];
  let anyOk = false;
  let anyFail = false;

  for (const r of allRecipients) {
    const idem = `cot-${cot.id}-${timestamp}-${r.email}`;
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          templateName: 'cotizacion-enviada',
          recipientEmail: r.email,
          idempotencyKey: idem,
          templateData: { ...templateData, contacto: r.nombre },
        }),
      });
      const out = await resp.json().catch(() => ({}));
      const ok = resp.ok && (out?.success !== false || out?.queued === true);
      resultados.push({ email: r.email, tipo: r.tipo, ok, error: ok ? undefined : (out?.error ?? `HTTP ${resp.status}`) });
      if (ok) anyOk = true; else anyFail = true;
    } catch (e) {
      resultados.push({ email: r.email, tipo: r.tipo, ok: false, error: (e as Error).message });
      anyFail = true;
    }
  }

  const estadoEnvio = anyOk && anyFail ? 'parcial' : anyOk ? 'enviado' : 'fallido';

  // Insertar en cotizacion_envios
  const { data: envio, error: envioErr } = await admin
    .from('cotizacion_envios')
    .insert({
      cotizacion_id: cot.id,
      organization_id: cot.organization_id,
      enviado_por: userId,
      destinatarios: validRecipients,
      cc: ccEmails,
      asunto,
      mensaje,
      pdf_storage_path: pdfStoragePath,
      pdf_link_publico: pdfLink,
      estado: estadoEnvio,
      error: anyFail ? JSON.stringify(resultados.filter((r) => !r.ok)) : null,
    })
    .select('id')
    .single();

  if (envioErr) {
    console.error('Failed to insert cotizacion_envios', envioErr);
  }

  // Bitácora
  await admin.from('bitacora_actividad').insert({
    organization_id: cot.organization_id,
    usuario_id: userId,
    accion: anyOk ? 'cotizacion_enviada_email' : 'cotizacion_envio_email_fallido',
    entidad: 'cotizacion',
    entidad_id: cot.id,
    detalles: {
      envio_id: envio?.id ?? null,
      destinatarios: validRecipients.map((d) => d.email),
      cc: ccEmails,
      resultados,
    },
  }).then(() => null, () => null);

  // Transición de estado a Enviada (solo desde Borrador)
  if (anyOk && marcarEnviada && cot.estado === 'Borrador') {
    await admin
      .from('cotizaciones')
      .update({ estado: 'Enviada', fecha_envio: new Date().toISOString() })
      .eq('id', cot.id);
  } else if (anyOk && cot.estado === 'Borrador') {
    // Aún si no marca Enviada, registrar fecha_envio si no existe
    await admin
      .from('cotizaciones')
      .update({ fecha_envio: new Date().toISOString() })
      .eq('id', cot.id)
      .is('fecha_envio', null);
  }

  return json({
    success: anyOk,
    estado: estadoEnvio,
    envio_id: envio?.id ?? null,
    resultados,
    pdf_link: pdfLink,
  });
});
