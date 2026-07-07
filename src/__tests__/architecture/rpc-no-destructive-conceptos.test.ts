/**
 * Guardrail arquitectónico (v13.207.0).
 *
 * Detecta migraciones que reintroduzcan el patrón destructivo
 *   DELETE FROM conceptos_venta WHERE embarque_id = ...
 *   INSERT INTO conceptos_venta ...
 * dentro del cuerpo de una función. Ese patrón rompía la trazabilidad con
 * proformas/facturas porque borraba conceptos ya facturados y los recreaba
 * como pendientes (ver bug reparado en ELIMP00195).
 *
 * Las migraciones anteriores al fix están listadas en la allowlist.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const TABLAS_PROTEGIDAS = ["conceptos_venta", "conceptos_costo"] as const;

// Migraciones históricas (previas al fix) que legítimamente contenían el
// patrón. Cualquier migración NUEVA que lo reintroduzca hará fallar el test.
const ALLOWLIST = new Set<string>([
  "20260313065240_d41b45c7-9c3e-46cb-a856-4bee41ad1f88.sql",
  "20260313065940_bb4d9629-cacb-47aa-be95-aa742633d8db.sql",
  "20260313070348_f2c54d97-1ec8-4d34-a2bf-679dc6bc3d73.sql",
  "20260326215709_d7186378-3972-41c7-bf8f-02e755e5fbfb.sql",
  "20260413013536_cc22d70a-248f-48b4-b3e1-0487013e619a.sql",
  "20260515195451_31d04a9c-3e27-46e8-a79a-b5fd506215f6.sql",
  "20260516195302_46cddeca-c330-446e-b180-08c3ebd66423.sql",
]);

function contieneDeleteInsertPeligroso(sql: string, tabla: string): boolean {
  const lower = sql.toLowerCase();
  const deleteRegex = new RegExp(`delete\\s+from\\s+(public\\.)?${tabla}\\b`, "i");
  const insertRegex = new RegExp(`insert\\s+into\\s+(public\\.)?${tabla}\\b`, "i");
  const deleteIdx = lower.search(deleteRegex);
  if (deleteIdx === -1) return false;
  const insertIdx = lower.slice(deleteIdx).search(insertRegex);
  return insertIdx !== -1;
}

describe("Migraciones — no destruir conceptos facturados", () => {
  it.each(TABLAS_PROTEGIDAS)(
    "ninguna migración nueva combina DELETE+INSERT sobre %s",
    (tabla) => {
      const infractoras: string[] = [];
      for (const archivo of readdirSync(MIGRATIONS_DIR)) {
        if (!archivo.endsWith(".sql")) continue;
        if (ALLOWLIST.has(archivo)) continue;
        const sql = readFileSync(join(MIGRATIONS_DIR, archivo), "utf8");
        if (contieneDeleteInsertPeligroso(sql, tabla)) {
          infractoras.push(archivo);
        }
      }
      expect(
        infractoras,
        `Migraciones con DELETE+INSERT sobre ${tabla} (usa merge por id):\n${infractoras.join("\n")}`,
      ).toEqual([]);
    },
  );
});
