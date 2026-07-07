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

// Migraciones anteriores al fix v13.207.0 (timestamp `20260707000409`) que
// legítimamente contenían el patrón. Cualquier migración NUEVA que lo
// reintroduzca hará fallar el test.
const FIX_TIMESTAMP = "20260707000409";
function esHistorica(nombreArchivo: string): boolean {
  const ts = nombreArchivo.slice(0, 14);
  return /^\d{14}$/.test(ts) && ts < FIX_TIMESTAMP;
}

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
        if (esHistorica(archivo)) continue;
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
