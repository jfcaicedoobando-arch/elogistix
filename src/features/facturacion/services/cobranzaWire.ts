import { z } from "zod";

/** JSONB boundary: absent/invalid figures are errors, never fabricated zeroes. */
export const kpisCobranzaSchema = z.object({
  total_mxn: z.number().finite(),
  total_usd: z.number().finite(),
  vencido_mxn: z.number().finite(),
  vencido_usd: z.number().finite(),
  por_vencer_7d_mxn: z.number().finite(),
  por_vencer_7d_usd: z.number().finite(),
  facturas_vencidas: z.number().int().nonnegative(),
  facturas_con_saldo: z.number().int().nonnegative(),
});
export type KpisCobranzaRemotos = z.infer<typeof kpisCobranzaSchema>;
