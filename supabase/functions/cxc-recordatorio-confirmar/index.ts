import { wrapEdgeHandler } from '../_shared/sentry.ts';
import { handleRecordatorioConfirmado } from '../cxc-recordatorio-enviar/handler.ts';

// Nombre nuevo: una UI v2 nunca puede invocar sin querer un backend de envío antiguo.
Deno.serve(wrapEdgeHandler('cxc-recordatorio-confirmar', handleRecordatorioConfirmado));
