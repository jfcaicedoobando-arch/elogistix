import { authenticate, authorizeOrgRole, ROLES_COBRANZA_FISCAL } from '../_shared/auth.ts';
import { buildCors, handlePreflightStrict } from '../_shared/cors.ts';
import { wrapEdgeHandler } from '../_shared/sentry.ts';
import { resolveDestinatarioRecordatorio } from '../_shared/recordatorioDestinatario.ts';
import { BodySchema } from '../cxc-recordatorio-enviar/bodySchema.ts';
import { createDestinatarioRecordatorioHandler } from './handler.ts';

const schema = BodySchema.pick({ factura_id: true });
const handler = createDestinatarioRecordatorioHandler({
  authenticate,
  authorize: (client, userId, orgId) => authorizeOrgRole(client, userId, orgId, ROLES_COBRANZA_FISCAL),
  resolve: resolveDestinatarioRecordatorio,
  parseFacturaId: (body) => {
    const result = schema.safeParse(body);
    return result.success ? result.data.factura_id : null;
  },
  preflight: handlePreflightStrict,
  cors: buildCors,
});

Deno.serve(wrapEdgeHandler('cxc-recordatorio-destinatario', handler));
