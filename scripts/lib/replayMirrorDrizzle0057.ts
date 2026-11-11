/** Exact model of 0057's two replacements inside the fixed policy fingerprint.
 * No live catalog, mirror or snapshot participates in deriving the result.
 * PostgreSQL replay still verifies that the literal matches the actual policies.
 */
import { createHash } from "node:crypto";
import { huellaDefinicion, type indexarMigraciones } from "./replayMirror";

export const PATCH_0057 = "0057_pricing_vinculo_huella_rls_initplan.sql";
export const PATCH_0057_SHA256 = "418eb056e2e30a488be88bf711259f462216fd1f16cb29feb1392237d5e5a7fd";
const SIGNATURE = "crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)";
const PREIMAGE = "070b4b15ba2c8951b6dff97e6fa8eeb2b489a2230a8a8130bc6f103a1641de1d";
const POSTIMAGE = "44f0897fe4caaba20b90145aed4c6bbb8cc5e668cbe0f2e1d8baa09c76063fcd";
type Index = ReturnType<typeof indexarMigraciones>;
const replacements = [
  ["has_role(auth.uid(), 'cliente'::app_role) AND (cliente_id IN", "has_role(( SELECT auth.uid() AS uid), 'cliente'::app_role) AND (cliente_id IN"],
  ["(created_by = auth.uid())", "(created_by = ( SELECT auth.uid() AS uid))"],
] as const;

export function aplicarDrizzle0057(index: Index, sources: ReadonlyMap<string, string>): Index {
  const sql = sources.get(PATCH_0057);
  if (!sql || createHash("sha256").update(sql).digest("hex") !== PATCH_0057_SHA256) {
    throw new Error("Drizzle0057: unsupported or missing patch source");
  }
  const previous = index.get(SIGNATURE);
  if (!previous || previous.migracion !== "20261010015800_pricing_cliente_linaje.sql"
    || huellaDefinicion(previous.definicion) !== PREIMAGE) {
    throw new Error("Drizzle0057: preimage changed for pricing policy fingerprint");
  }
  const definition: string[] = JSON.parse(previous.definicion.cuerpo);
  const policyParts = definition[1]?.split("$policies$");
  if (definition.length !== 3 || policyParts?.length !== 3) {
    throw new Error("Drizzle0057: unexpected policy literal boundaries");
  }
  for (const [before, after] of replacements) {
    if (policyParts[1].split(before).length - 1 !== 1) {
      throw new Error("Drizzle0057: unexpected replacement count");
    }
    policyParts[1] = policyParts[1].split(before).join(after);
  }
  definition[1] = policyParts.join("$policies$");
  const definicion = { ...previous.definicion, cuerpo: JSON.stringify(definition) };
  if (huellaDefinicion(definicion) !== POSTIMAGE) throw new Error("Drizzle0057: unexpected postimage");
  const result = new Map(index);
  result.set(SIGNATURE, { migracion: `drizzle/migrations/${PATCH_0057}`, definicion });
  return result;
}
