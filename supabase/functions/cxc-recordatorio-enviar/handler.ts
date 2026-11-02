import { authenticate, authorizeOrgRole, ROLES_COBRANZA_FISCAL } from '../_shared/auth.ts';
import { buildCors, handlePreflightStrict } from '../_shared/cors.ts';
import { ConfirmarBodySchema } from './bodySchema.ts';
import { RevisionDestinatarioError, validarDestinatarioConfirmado } from '../_shared/recordatorioDestinatario.ts';
import { buildTemplateData, loadFactura, loadOrgName, loadPerfil, loadSaldoFactura } from './factura.ts';
import { messageIdRecordatorio, sendRecordatorio } from './entrega.ts';

/** Ambos adaptadores de envío exigen el mismo contrato de confirmación. */
export async function handleRecordatorioConfirmado(req: Request): Promise<Response> {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
    status, headers: { ...buildCors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  try {
    const { userId, adminClient } = await authenticate(req);
    const parsed = ConfirmarBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ code: 'CONFIRMACION_DESTINATARIO_REQUERIDA',
      error: 'Vuelve a consultar y revisa el destinatario antes de enviar el recordatorio.' }, 409);
    const { factura_id, nota, canal, destinatario_confirmado } = parsed.data;
    const { factura, error: facturaError } = await loadFactura(adminClient, factura_id);
    if (facturaError) return json({ error: 'No se pudo consultar la factura' }, 500);
    if (!factura) return json({ error: 'Factura no encontrada' }, 404);
    if (!await authorizeOrgRole(adminClient, userId, factura.organization_id, ROLES_COBRANZA_FISCAL)) {
      return json({ error: 'No autorizado para esta organización' }, 403);
    }
    await validarDestinatarioConfirmado(adminClient, factura, destinatario_confirmado);
    factura.saldo = await loadSaldoFactura(adminClient, factura.id);
    const [perfil, orgName] = await Promise.all([
      loadPerfil(adminClient, userId), loadOrgName(adminClient, factura.organization_id),
    ]);
    const templateData = buildTemplateData(factura, orgName, perfil, nota);

    // Releer identidad y permisos tras preparar datos, antes de invocar transporte.
    // Éste aún renderiza la plantilla: no hay atomicidad con el proveedor externo.
    const { data: actual, error: actualError } = await adminClient.from('facturas')
      .select('id, organization_id, cliente_id').eq('id', factura_id).maybeSingle();
    if (actualError) return json({ error: 'No se pudo comprobar la factura antes de enviar' }, 500);
    if (!actual) throw new RevisionDestinatarioError('FACTURA_CAMBIO',
      'La factura ya no está disponible. Revisa el documento antes de continuar.');
    if (!await authorizeOrgRole(adminClient, userId, actual.organization_id, ROLES_COBRANZA_FISCAL)) {
      return json({ error: 'No autorizado para esta organización' }, 403);
    }
    const destinatario = await validarDestinatarioConfirmado(adminClient, actual, destinatario_confirmado);
    const messageId = messageIdRecordatorio(factura.id, canal);
    await sendRecordatorio(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      destinatario, templateData, messageId);
    const { error: insertError } = await adminClient.from('factura_recordatorios').insert({
      factura_id: factura.id, organization_id: factura.organization_id, enviado_por: userId,
      canal, nota: nota ?? null,
    });
    if (insertError) {
      // El envío ya ocurrió: el fallo del historial no debe inducir un reenvío.
      console.error('cxc-recordatorio: envío OK pero falló el historial', { message_id: messageId });
    }
    return json({ ok: true, enviado_a: destinatario }, 200);
  } catch (err) {
    if (err instanceof RevisionDestinatarioError) return json({ code: err.code, error: err.message }, 409);
    const msg = err instanceof Error ? err.message : '';
    if (msg.startsWith('401:')) return json({ error: 'No autorizado' }, 401);
    return json({ error: 'No se pudo enviar el recordatorio' }, 500);
  }
}
