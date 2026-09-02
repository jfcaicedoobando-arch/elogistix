import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'npm:zod@3.23.8';
import { buildCors, handlePreflightStrict } from '../_shared/cors.ts';
import { wrapEdgeHandler } from '../_shared/sentry.ts';
import { authenticate, authorizeOrgRole, ROLES_COBRANZA_FISCAL } from '../_shared/auth.ts';
import { enviarEmailPlantilla } from '../_shared/enviarEmailPlantilla.ts';

import { DESTINATARIO_NO_PERMITIDO, emailPerteneceACliente } from '../_shared/destinatarioCliente.ts';


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
  // A8 (v13.469.0): `facturas` no tiene columna `saldo`; se calcula con la RPC
  // `saldo_factura` (pagos aplicados y notas de crédito vigentes).
  const { data, error } = await adminClient
    .from('facturas')
    .select('id, organization_id, cliente_id, numero, serie, folio, cliente_nombre, total, moneda, fecha_vencimiento')
    .eq('id', facturaId)
    .maybeSingle();
  if (error) return { factura: null, error: `Error al leer factura: ${error.message}` };
  if (!data) return { factura: null, error: null };

  const { data: saldo, error: errSaldo } = await adminClient.rpc('saldo_factura', {
    p_factura_id: facturaId,
  });
  if (errSaldo) return { factura: null, error: `Error al calcular el saldo: ${errSaldo.message}` };

  return { factura: { ...(data as Omit<FacturaRecordatorio, 'saldo'>), saldo: Number(saldo ?? 0) }, error: null };
}

/**
 * Ronda YAGNI · defecto 9 — la cobranza externa ya no depende de la mera
 * membresía: exige rol exacto de cobranza/fiscal (`ROLES_COBRANZA_FISCAL`).
 * `operador` y `viewer` reciben 403.
 */
function autorizarCobranza(
  adminClient: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  return authorizeOrgRole(adminClient, userId, organizationId, ROLES_COBRANZA_FISCAL);
}

async function resolveDestinatario(
  adminClient: SupabaseClient,
  clienteId: string,
  contactoEmail?: string | null,
): Promise<string | null> {
  // M8: un destinatario explícito debe pertenecer al cliente.
  if (contactoEmail) {
    const permitido = await emailPerteneceACliente(adminClient, clienteId, contactoEmail);
    return permitido ? contactoEmail : null;
  }

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
  const moneda = factura.moneda ?? 'MXN';
  const numero = factura.numero ?? `${factura.serie}-${factura.folio}`;
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

// R3 · P2: ventana de idempotencia — un doble clic / reintento dentro de la
// misma ventana reutiliza el message_id, y la cola deduplica por
// email_send_log (isAlreadySent) en vez de enviar dos correos al cliente.
export const VENTANA_IDEMPOTENCIA_MS = 10 * 60 * 1000;

export function messageIdRecordatorio(facturaId: string, canal: string, now: number = Date.now()): string {
  const ventana = Math.floor(now / VENTANA_IDEMPOTENCIA_MS);
  return `recordatorio-${facturaId}-${canal}-${ventana}`;
}

async function sendRecordatorio(
  supabaseUrl: string,
  serviceRoleKey: string,
  destinatario: string,
  templateData: TemplateData,
  messageId: string,
): Promise<void> {
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const envio = await enviarEmailPlantilla(admin, {
    templateName: 'recordatorio-cobranza',
    recipientEmail: destinatario,
    messageId,
    idempotencyKey: messageId,
    templateData: templateData as unknown as Record<string, unknown>,
  });
  if (!envio.ok) {
    throw new Error(`Error al enviar correo: ${envio.error ?? 'desconocido'}`);
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

    const { factura, error: facturaError } = await loadFactura(supabaseAdmin, factura_id);
    if (facturaError) throw new Error(`500:${facturaError}`);
    if (!factura) return corsJson({ error: 'Factura no encontrada' }, 404, req);

    const autorizado = await autorizarCobranza(supabaseAdmin, userId, factura.organization_id);
    if (!autorizado) {
      return corsJson({ error: 'No autorizado para esta organización' }, 403, req);
    }

    const destinatario = await resolveDestinatario(supabaseAdmin, factura.cliente_id, contacto_email);
    if (!destinatario) {
      return contacto_email
        ? corsJson(
            {
              error: 'El correo no pertenece a los contactos del cliente',
              code: DESTINATARIO_NO_PERMITIDO,
            },
            400,
            req,
          )
        : corsJson({ error: 'No hay correo de contacto para enviar el recordatorio' }, 400, req);
    }


    const [perfil, orgName] = await Promise.all([
      loadPerfil(supabaseAdmin, userId),
      loadOrgName(supabaseAdmin, factura.organization_id),
    ]);

    const templateData = buildTemplateData(factura, orgName, perfil, nota);
    // R3 · P2: PRIMERO se envía (encola) y SÓLO si tuvo éxito se registra el
    // recordatorio — antes la fila quedaba como "enviado" aunque el envío
    // fallara (historial de cobranza falso). El message_id es estable por
    // (factura, canal, ventana de 10 min) para deduplicar dobles clics.
    const messageId = messageIdRecordatorio(factura.id, canal);
    await sendRecordatorio(supabaseUrl, serviceRoleKey, destinatario, templateData, messageId);

    const { error: insertError } = await supabaseAdmin.from('factura_recordatorios').insert({
      factura_id: factura.id,
      organization_id: factura.organization_id,
      enviado_por: userId,
      canal,
      nota: nota ?? null,
    });
    if (insertError) {
      // El correo YA salió: no devolvemos 500 al usuario (reintentaría y
      // duplicaría); el fallo de historial queda en logs/Sentry.
      console.error('cxc-recordatorio-enviar: envío OK pero falló el registro', {
        factura_id: factura.id,
        error: insertError.message,
      });
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

