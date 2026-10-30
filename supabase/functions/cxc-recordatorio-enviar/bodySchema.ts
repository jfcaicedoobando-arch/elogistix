import { z } from 'npm:zod@4.6.7';
import { cxcEmail, cxcGuid } from '../_shared/cxcInputValidation.ts';

export const BodySchema = z.object({
  factura_id: cxcGuid(),
  nota: z.string().max(2000).optional(),
  canal: z.enum(['email']).default('email'),
  contacto_email: cxcEmail().optional().nullable(),
});
