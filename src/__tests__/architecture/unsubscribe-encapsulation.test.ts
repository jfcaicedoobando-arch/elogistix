/**
 * Blinda Fase 1 item #4: `pages/auth/Unsubscribe.tsx` no debe volver a
 * usar `fetch()` raw ni leer `VITE_SUPABASE_*` directamente.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const src = readFileSync(join(ROOT, "src/features/auth/routes/Unsubscribe.tsx"), "utf8");

describe("Fase 1 #4 — Unsubscribe encapsulado", () => {
  it("no contiene `fetch(`", () => {
    expect(src).not.toMatch(/\bfetch\(/);
  });

  it("no referencia VITE_SUPABASE_URL", () => {
    expect(src).not.toMatch(/VITE_SUPABASE_URL/);
  });

  it("no referencia VITE_SUPABASE_PUBLISHABLE_KEY ni VITE_SUPABASE_ANON_KEY", () => {
    expect(src).not.toMatch(/VITE_SUPABASE_(PUBLISHABLE|ANON)_KEY/);
  });

  it("usa el wrapper @/services/unsubscribeService", () => {
    expect(src).toMatch(/from\s+["']@\/services\/unsubscribeService["']/);
  });
});
