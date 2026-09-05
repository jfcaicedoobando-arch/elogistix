/**
 * Normaliza `types.ts` para comparar el archivo committeado contra el generado
 * desde el esquema de migraciones (job `types-drift`).
 *
 * Dos fuentes de ruido que NO son drift real de esquema:
 *  1. El bloque `__InternalSupabase` (PostgrestVersion) depende de la version
 *     del servidor, no del esquema.
 *  2. Las funciones de extensiones (pgcrypto, uuid-ossp): en Supabase viven en
 *     el schema `extensions`, pero un `CREATE EXTENSION` sin `SCHEMA` en la BD
 *     efimera de CI las deja en `public` y el generador las incluye.
 *
 * Uso: bun scripts/ci/normalize-supabase-types.ts <archivo>
 */
import { readFileSync } from "node:fs";

const EXTENSION_FN = new RegExp(
  "^\\s+(" +
    [
      "armor",
      "crypt",
      "dearmor",
      "decrypt",
      "decrypt_iv",
      "digest",
      "encrypt",
      "encrypt_iv",
      "gen_random_bytes",
      "gen_random_uuid",
      "gen_salt",
      "hmac",
      "pgp_[a-z0-9_]+",
      "uuid_[a-z0-9_]+",
      "set_limit",
      "show_limit",
      "show_trgm",
      "similarity[a-z_]*",
      "word_similarity[a-z_]*",
      "strict_word_similarity[a-z_]*",
    ].join("|") +
    "): \\{",
);

function stripBlockAt(lines: string[], start: number): number {
  // Devuelve el indice de la ultima linea del bloque que abre en `start`.
  let depth = 0;
  for (let i = start; i < lines.length; i += 1) {
    for (const ch of lines[i]) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
    }
    if (depth <= 0) return i;
  }
  return start;
}

/**
 * Los helpers finales (`Tables`, `TablesInsert`, `Enums`, ...) cambian de
 * parentesis segun la version del generador: `extends (X extends {...} ? A :
 * never) = never` vs `extends X extends {...} ? A : never = never`. Es ruido
 * cosmetico, no drift de esquema.
 */
function stripHelperParens(source: string): string {
  return source
    .replace(/extends \((\w+NameOrOptions extends \{)/g, "extends $1")
    .replace(/: never\) = never,/g, ": never = never,");
}

export function normalizeTypes(source: string): string {
  const lines = stripHelperParens(source).split("\n");

  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes("__InternalSupabase: {") || EXTENSION_FN.test(line)) {
      i = stripBlockAt(lines, i);
      continue;
    }
    if (
      line.includes("Allows to automatically instantiate createClient") ||
      line.includes("instead of createClient<Database, { PostgrestVersion")
    ) {
      continue;
    }
    const trimmed = line.replace(/\s+$/, "");
    if (trimmed === "") continue;
    out.push(trimmed);
  }
  return `${out.join("\n")}\n`;
}

const file = process.argv[2];
if (file) {
  process.stdout.write(normalizeTypes(readFileSync(file, "utf8")));
}
