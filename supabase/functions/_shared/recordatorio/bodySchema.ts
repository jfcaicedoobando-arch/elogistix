import { z } from 'npm:zod@4.6.7';
import { cxcEmail, cxcGuid } from '../cxcInputValidation.ts';

export const BodySchema = z.object({
  factura_id: cxcGuid(),
  nota: z.string().max(2000).optional(),
  canal: z.enum(['email']).default('email'),
  contacto_email: cxcEmail().optional().nullable(),
});

export const DestinatarioConfirmadoSchema = z.object({
  organization_id: cxcGuid(),
  cliente_id: cxcGuid(),
  contacto_id: cxcGuid(),
  email: cxcEmail(),
}).strict();

// El códec base conserva las fixtures históricas; ningún envío lo usa solo.
export const ConfirmarBodySchema = BodySchema.omit({ contacto_email: true }).extend({
  confirmacion_version: z.literal(2),
  destinatario_confirmado: DestinatarioConfirmadoSchema,
}).strict();
