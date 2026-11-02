import { wrapEdgeHandler } from '../_shared/sentry.ts';
import { handleRecordatorioConfirmado } from '../_shared/recordatorio/handler.ts';

// Clientes anteriores sin identidad confirmada fallan cerrado, sin allowlist alternativa.
Deno.serve(wrapEdgeHandler('cxc-recordatorio-enviar', handleRecordatorioConfirmado));
