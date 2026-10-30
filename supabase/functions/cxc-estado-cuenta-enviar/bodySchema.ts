import { z } from 'npm:zod@4.6.7';
import { cxcEmail, cxcGuid } from '../_shared/cxcInputValidation.ts';

export const BodySchema = z.object({
  cliente_id: cxcGuid(),
  periodo: z.string().max(100).optional().nullable(),
  contacto_email: cxcEmail().optional().nullable(),
  mensaje: z.string().max(2000).optional().nullable(),
  fecha_desde: z.string().optional().nullable(),
  fecha_hasta: z.string().optional().nullable(),
});

export type EstadoCuentaInput = z.infer<typeof BodySchema>;
