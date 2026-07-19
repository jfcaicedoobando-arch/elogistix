/**
 * Guardrail Fase R.7 (Bug menor C): trigger que impide soft-delete de proformas
 * en estado `facturada`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

function findLatestBody(): string {
  const files = readdirSync(MIGRATIONS_DIR).sort();
  let latest = "";
  for (const f of files) {
    const body = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
    if (/enforce_proforma_no_soft_delete_facturada/i.test(body)) {
      latest = body;
    }
  }
  return latest;
}

describe("proforma facturada no admite soft-delete", () => {
  const body = findLatestBody();

  it("define la función guardián", () => {
    expect(body).toMatch(/FUNCTION\s+public\.enforce_proforma_no_soft_delete_facturada/i);
  });

  it("lanza LC_PROFORMA_FACTURADA_NO_ELIMINABLE", () => {
    expect(body).toMatch(/LC_PROFORMA_FACTURADA_NO_ELIMINABLE/);
  });

  it("crea el trigger BEFORE UPDATE OF deleted_at sobre proformas", () => {
    expect(body).toMatch(
      /CREATE\s+TRIGGER\s+trg_proforma_no_soft_delete_facturada[\s\S]*?BEFORE\s+UPDATE\s+OF\s+deleted_at[\s\S]*?ON\s+public\.proformas/i,
    );
  });
});
