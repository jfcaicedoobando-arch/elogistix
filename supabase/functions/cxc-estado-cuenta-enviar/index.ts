import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'npm:zod@3.23.8';
import { buildCors, handlePreflightStrict } from '../_shared/cors.ts';
import { wrapEdgeHandler } from '../_shared/sentry.ts';
import { authenticate, authorizeOrgRole, ROLES_COBRANZA_FISCAL } from '../_shared/auth.ts';
import { enviarEmailPlantilla } from '../_shared/enviarEmailPlantilla.ts';

import { DESTINATARIO_NO_PERMITIDO, emailPerteneceACliente } from '../_shared/destinatarioCliente.ts';
import {
  calcularTotalesPorMoneda,
  formatPorMoneda,
  MONEDA_ESTADO_CUENTA_DEFAULT,
} from './totales.ts';


const BodySchema = z.object({
  cliente_id: z.string().uuid(),
  periodo: z.string().max(100).optional().nullable(),
  contacto_email: z.string().email().optional().nullable(),
  mensaje: z.string().max(2000).optional().nullable(),
  fecha_desde: z.string().optional().nullable(),
  fecha_hasta: z.string().optional().nullable(),
});

interface FacturaCliente {
  total: number | null;
  saldo: number | null;
  moneda: string | null;
  fecha_vencimiento: string | null;
  estado: string | null;
}

interface ClienteOrg {
  id: string;
  organization_id: string;
  nombre: string | null;
}

function corsJson(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCors(req), 'Content-Type': 'application/json' },
  });
}


async function loadCliente(
  adminClient: SupabaseClient,
  clienteId: string,
): Promise<{ cliente: ClienteOrg | null; error: string | null }> {
  const { data, error } = await adminClient
    .from('clientes')
    .select('id, organization_id, nombre')
    .eq('id', clienteId)
    .maybeSingle();
  if (error) return { cliente: null, error: `Error al leer cliente: ${error.message}` };
  return { cliente: data as ClienteOrg | null, error: null };
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

async function loadFacturasVivas(
  adminClient: SupabaseClient,
  clienteId: string,
  desde: string | null | undefined,
  hasta: string | null | undefined,
): Promise<FacturaCliente[]> {
  // A8 (v13.469.0): `facturas` no tiene columna `saldo` (se calcula con pagos y
  // notas de crédito vigentes). La RPC devuelve el saldo real y ya excluye
  // Borrador / Cancelada / Sustituida.
  const { data, error } = await adminClient.rpc('facturas_cartera_cliente', {
    p_cliente_id: clienteId,
    p_desde: desde ?? null,
    p_hasta: hasta ?? null,
  });
  if (error) throw new Error(`Error al leer facturas: ${error.message}`);
  return (data ?? []) as FacturaCliente[];
}

// M9: los totales viven en `totales.ts` (lógica pura, agrupada por moneda y
// con las facturas parcialmente pagadas incluidas en el vencido).


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

/**
 * Ronda YAGNI · defecto 9 — la clave del envío se deriva de la petición
 * (cliente + periodo + destinatario) y NO de `Date.now()`: reintentar el mismo
 * estado de cuenta no vuelve a enviar el correo.
 */
export function messageIdEstadoCuenta(
  clienteId: string,
  desde: string | null | undefined,
  hasta: string | null | undefined,
  destinatario: string,
): string {
  const periodo = `${desde ?? 'inicio'}_${hasta ?? 'hoy'}`;
  return `estado-cuenta-${clienteId}-${periodo}-${destinatario.toLowerCase()}`;
}

/** ¿Ya se envió este mismo estado de cuenta? (dedupe por message_id) */
async function yaEnviado(admin: SupabaseClient, messageId: string): Promise<boolean> {
  const { data } = await admin
    .from('email_send_log')
    .select('status')
    .eq('message_id', messageId)
    .maybeSingle();
  return data?.status === 'sent';
}

async function sendEstadoCuenta(
  supabaseUrl: string,
  serviceRoleKey: string,
  destinatario: string,
  templateData: Record<string, unknown>,
  messageId: string,
): Promise<void> {
  const admin = createClient(supabaseUrl, serviceRoleKey);
  if (await yaEnviado(admin, messageId)) return;
  const envio = await enviarEmailPlantilla(admin, {
    templateName: 'estado-cuenta-cliente',
    recipientEmail: destinatario,
    messageId,
    idempotencyKey: messageId,
    templateData,
  });
  if (!envio.ok) {
    throw new Error(`Error al enviar correo: ${envio.error ?? 'desconocido'}`);
  }
}

async function buildTemplateData(
  cliente: ClienteOrg,
  facturas: FacturaCliente[],
  userId: string,
  supabaseAdmin: SupabaseClient,
  input: z.infer<typeof BodySchema>,
): Promise<Record<string, unknown>> {
  const { periodo, mensaje } = input;
  const totales = calcularTotalesPorMoneda(facturas);
  const monedas = totales.map((t) => t.moneda);

  const [perfil, orgName] = await Promise.all([
    loadPerfil(supabaseAdmin, userId),
    loadOrgName(supabaseAdmin, cliente.organization_id),
  ]);

  const publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://librecarga.com';
  return {
    cliente: cliente.nombre ?? orgName ?? 'Cliente',
    periodo: periodo ?? '',
    totalFacturas: formatPorMoneda(totales, 'total'),
    totalSaldo: formatPorMoneda(totales, 'saldo'),
    totalVencido: formatPorMoneda(totales, 'vencido'),
    desgloseMonedas: totales,
    moneda: monedas.length === 1 ? monedas[0] : monedas.join(', ') || MONEDA_ESTADO_CUENTA_DEFAULT,
    mensaje: mensaje ?? '',
    enlacePortal: `${publicSiteUrl}/portal/estado-de-cuenta`,
    ejecutivoNombre: perfil?.nombre ?? '',
    ejecutivoEmail: perfil?.email ?? '',
    ejecutivoTelefono: perfil?.telefono ?? '',
  };
}

async function runEnvio(
  req: Request,
  userId: string,
  adminClient: SupabaseClient,
  input: z.infer<typeof BodySchema>,
): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { cliente_id, contacto_email, fecha_desde, fecha_hasta } = input;

  const { cliente, error: clienteError } = await loadCliente(supabaseAdmin, cliente_id);
  if (clienteError) throw new Error(`500:${clienteError}`);
  if (!cliente) return corsJson({ error: 'Cliente no encontrado' }, 404, req);

  const autorizado = await autorizarCobranza(supabaseAdmin, userId, cliente.organization_id);
  if (!autorizado) return corsJson({ error: 'No autorizado para esta organización' }, 403, req);

  const facturas = await loadFacturasVivas(supabaseAdmin, cliente_id, fecha_desde, fecha_hasta);
  const destinatario = await resolveDestinatario(supabaseAdmin, cliente_id, contacto_email);
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
      : corsJson({ error: 'No hay correo de contacto para enviar el estado de cuenta' }, 400, req);
  }


  const templateData = await buildTemplateData(cliente, facturas, userId, supabaseAdmin, input);
  await sendEstadoCuenta(supabaseUrl, serviceRoleKey, destinatario, templateData);
  return corsJson({ ok: true, enviado_a: destinatario }, 200, req);
}

Deno.serve(wrapEdgeHandler('cxc-estado-cuenta-enviar', async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;

  try {
    const { userId, adminClient } = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return corsJson({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, 400, req);
    }
    return await runEnvio(req, userId, adminClient, parsed.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('401:')) return corsJson({ error: msg.slice(4) }, 401, req);
    if (msg.startsWith('500:')) return corsJson({ error: msg.slice(4) }, 500, req);
    console.error('cxc-estado-cuenta-enviar error', err);
    return corsJson({ error: 'Error interno del servidor' }, 500, req);
  }
}));
