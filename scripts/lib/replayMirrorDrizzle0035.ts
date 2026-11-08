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

function verificarFuentePosterior(sources: ReadonlyMap<string, string>): void {
  // Reviewed0037 changes only the authorization guard and margin search_path;
  // it must not redefine either modeled0035 target. Pin exact bytes independently.
  const special = sources.get("0037_cotizacion_especial_trigger_permissions.sql");
  if (!special || createHash("sha256").update(special).digest("hex")
    !== "e398f843fa18c56f4cfd222d6329c24c3e259c406b817dbac2d7bab5fbb62eb0") {
    throw new Error("Drizzle0035: unreviewed later source");
  }
  // Reviewed0038 changes coordinator assignment, never either modeled target.
  const coordinator = sources.get("0038_coordinador_fijo_por_cliente.sql");
  if (!coordinator || createHash("sha256").update(coordinator).digest("hex")
    !== "6df25cd241868aea34f5d245db90ddc7de931b0fcce5268795eaf22706802c93") {
    throw new Error("Drizzle0035: unreviewed later source");
  }
  // Reviewed0039 only replaces the margin helper, never either modeled target.
  const margin = sources.get("0039_cotizacion_margen_moneda_homogenea.sql");
  if (!margin || createHash("sha256").update(margin).digest("hex")
    !== "4d20a86450c946c2d73845dbf41ff93d4fb93490243f8967737d1165bd163f79") {
    throw new Error("Drizzle0035: unreviewed later source");
  }
  const boundary = sources.get("0040_coordinador_permission_boundary.sql");
  if (!boundary || createHash("sha256").update(boundary).digest("hex")
    !== "b50b05b0f00dad9cac4ad6257ef8fa7676eca1a51e686513947e53425723fa6a") {
    throw new Error("Drizzle0035: unreviewed later source");
  }
  // Reviewed0041 only replaces the prospect trigger, never either modeled target.
  const prospect = sources.get("0041_prospecto_housekeeping_historicos.sql");
  if (!prospect || createHash("sha256").update(prospect).digest("hex")
    !== "4bc3ec9e2f34c10bd7091e8f1b9eb5e3458dce2b3f6d7664d8eec129fd27fd53") {
    throw new Error("Drizzle0035: unreviewed later source");
  }  // Reviewed0042–0048 apply legacy fixes outside both modeled targets.
  for (const [file, expected] of REVIEWED_FORWARD_FIXES) {
    const sql = sources.get(file);
    if (!sql || createHash("sha256").update(sql).digest("hex") !== expected) {
      throw new Error("Drizzle0035: unreviewed later source");
    }
  }
}

const REVIEWED_FORWARD_FIXES: ReadonlyArray<readonly [string, string]> = [
  ["0042_periodo_cerrado_campos_derivados.sql", "f342ee211925de673df88f4bcc6343e0ca0a33c2cab34659fe0972b49d929d65"],
  ["0043_bitacora_no_falsificable.sql", "54de7ba7ff1cee2d1850a3db1557e991780b963351e0724d5729549eea8964ac"],
  ["0044_efe_xml_hash_unico_vivo.sql", "c8b73a21472318ffffaa5a9dcb7d5ce5160d80bee15668c82962c0b8d5bbe44f"],
  ["0045_provision_owner_sin_membresia.sql", "bd14472b11d4009f5439daf045e3703d0fe3910cb73dce650c160956e62c23b6"],
  ["0046_cerrar_funciones_internas_abiertas.sql", "fbb3f321e91f0ffb29098ff38e16c9ac0424d1f7c21ed9a5e97950e015d15001"],
  ["0047_rls_auth_uid_initplan_backport.sql", "49f067b89ca5bdbc31299d621e05279639862799d0892d71cbce3cb8ea09d22a"],
  ["0048_limpieza_indices_duplicados.sql", "9e135244f1f96d2b03e2abc35c3deb1efa3d44f3ee85162f52cf16eecfba7645"]
];

function verificarOrdenJournal(sources: ReadonlyMap<string, string>, journal: JournalEntry[]): void {
  // The caller verifies every isolated source/mirror against HISTORY. Require
  // the actual current journal order too; a later migration needs fresh review.
  const current = journal.slice(26);
  const ordered = [...sources.keys()].filter(file => Number(file.slice(0, 4)) >= 26);
  const expectedTail = [PATCH_0035.slice(0, -4),
    "0036_cotizacion_handover_tenant_scope", "0037_cotizacion_especial_trigger_permissions",
    "0038_coordinador_fijo_por_cliente", "0039_cotizacion_margen_moneda_homogenea",
    "0040_coordinador_permission_boundary", "0041_prospecto_housekeeping_historicos",
    ...REVIEWED_FORWARD_FIXES.map(([file]) => file.slice(0, -4))];
  if (journal.length !== 49 || current.some((entry, offset) => entry.idx !== offset + 26
    || `${entry.tag}.sql` !== ordered[offset] || entry.when <= journal[entry.idx - 1].when)
    || current.length !== ordered.length || expectedTail.some((tag, offset) => journal[35 + offset]?.tag !== tag)) {
    throw new Error("Drizzle0035: unsupported source/journal order");
  }
}

export function aplicarDrizzle0035(index: Index, sources: ReadonlyMap<string, string>, journal: JournalEntry[]): Index {
  const sql = sources.get(PATCH_0035);
  if (!sql || createHash("sha256").update(sql).digest("hex") !== SOURCE_HASH) {
    throw new Error("Drizzle0035: unsupported or missing patch source");
  }
  verificarOrdenJournal(sources, journal);
  verificarFuentePosterior(sources);
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
