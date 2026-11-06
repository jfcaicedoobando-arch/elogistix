/** Bounded model of the reviewed dynamic patch, not a general SQL interpreter.
 * Source bytes and full preimages are mandatory. No mirror/snapshot is an input.
 * Runtime PostgreSQL replay remains authoritative for trigger/ACL/behavior checks.
 */
import { createHash } from "node:crypto";
import { huellaDefinicion, type indexarMigraciones } from "./replayMirror";
import { normalizeSql } from "./replayMirrorSql";

export const PATCH_0035 = "0035_cotizacion_aceptada_hasta_confirmar_embarque.sql";
const SOURCE_HASH = "9565c53c94e45d33bdf96242937dbaa0036dd7b122f0b7018739b0fe5128c277";
type Index = ReturnType<typeof indexarMigraciones>;
type JournalEntry = { idx: number; tag: string; when: number };
const patches = [
  { signature: "crear_embarque_borrador_core(uuid)", migration: "20261012224500_fix_conversion_puertos_uuid.sql",
    preimage: "010942b342450d07789d40d008f685296932ed78bd62294188ea641de6f3c663",
    old: "SET embarque_id = v_embarque_id, estado = 'En operación'::estado_cotizacion, updated_at = now()",
    next: "SET embarque_id = v_embarque_id, updated_at = now()", occurrences: 1 },
  { signature: "sync_cotizacion_embarque_link()", migration: "20260901001000_fix4_n1_papelera_libera_cotizacion.sql",
    preimage: "91dc157fab71e2277c2f4a21b589bd06abb30ca948a64ffde2870807a734cb5f",
    old: "NEW.estado <> 'Borrador'::estado_embarque",
    next: "NEW.estado NOT IN ('Borrador'::estado_embarque, 'Cotización'::estado_embarque, 'Cancelado'::estado_embarque)", occurrences: 2 },
] as const;

export function aplicarDrizzle0035(index: Index, sources: ReadonlyMap<string, string>, journal: JournalEntry[]): Index {
  const sql = sources.get(PATCH_0035);
  if (!sql || createHash("sha256").update(sql).digest("hex") !== SOURCE_HASH) {
    throw new Error("Drizzle0035: unsupported or missing patch source");
  }
  // The caller verifies every isolated source/mirror against HISTORY. Require
  // the actual current journal order too; a later migration needs fresh review.
  const current = journal.slice(26);
  const ordered = [...sources.keys()].filter(file => Number(file.slice(0, 4)) >= 26);
  if (journal.length !== 37 || current.some((entry, offset) => entry.idx !== offset + 26
    || `${entry.tag}.sql` !== ordered[offset] || entry.when <= journal[entry.idx - 1].when)
    || current.length !== ordered.length || journal[35].tag + ".sql" !== PATCH_0035
    || journal[36].tag !== "0036_cotizacion_handover_tenant_scope") {
    throw new Error("Drizzle0035: unsupported source/journal order");
  }
  const result = new Map(index);
  for (const patch of patches) {
    const previous = index.get(patch.signature);
    if (!previous || previous.migracion !== patch.migration
      || huellaDefinicion(previous.definicion) !== patch.preimage) {
      throw new Error(`Drizzle0035: preimage changed for ${patch.signature}`);
    }
    const parts: string[] = JSON.parse(previous.definicion.cuerpo);
    const before = normalizeSql(patch.old);
    if (parts.length !== 3 || parts[1].split(before).length - 1 !== patch.occurrences) {
      throw new Error(`Drizzle0035: unexpected replacement count for ${patch.signature}`);
    }
    // SQL replace changes every occurrence. All declaration attributes remain.
    parts[1] = parts[1].split(before).join(normalizeSql(patch.next));
    result.set(patch.signature, { migracion: `drizzle/migrations/${PATCH_0035}`,
      definicion: { ...previous.definicion, cuerpo: JSON.stringify(parts) } });
  }
  return result;
}
