import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
import { RevisionDestinatarioError, type DestinatarioConfirmado, type FacturaDestinatario } from '../_shared/recordatorioDestinatario.ts';

interface Dependencies {
  authenticate: (req: Request) => Promise<{ userId: string; adminClient: SupabaseClient }>;
  authorize: (client: SupabaseClient, userId: string, organizationId: string) => Promise<boolean>;
  resolve: (client: SupabaseClient, factura: FacturaDestinatario) => Promise<DestinatarioConfirmado | null>;
  parseFacturaId: (body: unknown) => string | null;
  preflight: (req: Request) => Response | null;
  cors: (req: Request) => Record<string, string>;
}

/** Consulta autorizada: no encola correos ni escribe historial de cobranza. */
export function createDestinatarioRecordatorioHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const preflight = deps.preflight(req);
    if (preflight) return preflight;
    const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
      status,
      headers: { ...deps.cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
    try {
      const { userId, adminClient } = await deps.authenticate(req);
      const facturaId = deps.parseFacturaId(await req.json().catch(() => null));
      if (!facturaId) return json({ error: 'Datos inválidos' }, 400);

      const { data: factura, error } = await adminClient.from('facturas')
        .select('id, organization_id, cliente_id').eq('id', facturaId).maybeSingle();
      if (error) return json({ error: 'No se pudo consultar la factura' }, 500);
      if (!factura) return json({ error: 'Factura no encontrada' }, 404);
      if (!await deps.authorize(adminClient, userId, factura.organization_id)) {
        return json({ error: 'No autorizado para esta organización' }, 403);
      }
      const destinatario = await deps.resolve(adminClient, factura);
      return json({ ok: true, version: 2, factura_id: factura.id, destinatario }, 200);
    } catch (err) {
      if (err instanceof RevisionDestinatarioError) return json({ code: err.code, error: err.message }, 409);
      const message = err instanceof Error ? err.message : '';
      if (message.startsWith('401:')) return json({ error: 'No autorizado' }, 401);
      // No registrar correos ni detalles del documento en mensajes de diagnóstico.
      return json({ error: 'No se pudo consultar el destinatario' }, 500);
    }
  };
}
