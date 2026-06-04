/**
 * Test de arquitectura — protege la jerarquía de capas:
 *   - `src/lib/**` NO puede importar de @/hooks, @/components ni @/pages.
 *   - `src/services/**` NO puede importar de @/hooks, @/components,
 *     @/pages ni @/contexts.
 *
 * Duplica las reglas ESLint `no-restricted-imports` definidas en
 * eslint.config.js como red de seguridad ante eliminaciones accidentales.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry) && !p.includes("__tests__")) out.push(p);
  }
  return out;
}

function findViolators(root: string, pattern: RegExp): string[] {
  const violators: string[] = [];
  for (const f of walk(root)) {
    const src = readFileSync(f, "utf8");
    if (pattern.test(src)) violators.push(f);
  }
  return violators;
}

function featureSubdirs(sub: "domain" | "services" | "hooks"): string[] {
  const root = "src/features";
  const out: string[] = [];
  try {
    for (const f of readdirSync(root)) {
      const p = join(root, f, sub);
      try {
        if (statSync(p).isDirectory()) out.push(p);
      } catch {
        /* missing subdir */
      }
    }
  } catch {
    /* features dir may not exist */
  }
  return out;
}

describe("Arquitectura: jerarquía de capas Pages→Hooks→Services→Lib", () => {
  it("src/lib no importa @/hooks, @/components o @/pages", () => {
    const pattern = /from\s+["']@\/(hooks|components|pages)\//;
    const violators = findViolators("src/lib", pattern);
    expect(violators, `Violaciones en lib/:\n${violators.join("\n")}`).toEqual([]);
  });

  it("src/services no importa @/hooks, @/components, @/pages o @/contexts", () => {
    const pattern = /from\s+["']@\/(hooks|components|pages|contexts)\//;
    const violators = findViolators("src/services", pattern);
    expect(violators, `Violaciones en services/:\n${violators.join("\n")}`).toEqual([]);
  });

  it("src/features/*/domain no importa hooks, components, pages, routes ni services (runtime)", () => {
    // Type-only imports (`import type ...`) están permitidos: no generan
    // acoplamiento en runtime y los tipos pueden cruzar capas.
    const pattern = /^\s*import\s+(?!type\s)[^;]*from\s+["'](@\/(hooks|components|pages)\/|@\/features\/[^/]+\/(hooks|components|routes|services)\/)/m;
    const violators = featureSubdirs("domain").flatMap((d) => findViolators(d, pattern));
    expect(violators, `Violaciones en features/*/domain:\n${violators.join("\n")}`).toEqual([]);
  });

  it("src/features/*/services no importa hooks, components, pages, contexts ni routes (runtime)", () => {
    const pattern = /^\s*import\s+(?!type\s)[^;]*from\s+["'](@\/(hooks|components|pages|contexts)\/|@\/features\/[^/]+\/(hooks|components|routes)\/)/m;
    const violators = featureSubdirs("services").flatMap((d) => findViolators(d, pattern));
    expect(violators, `Violaciones en features/*/services:\n${violators.join("\n")}`).toEqual([]);
  });


  it("hooks y contexts no importan @/integrations/supabase/client directamente", () => {
    // Whitelist: archivos que SÍ pueden tocar el client directamente.
    // Mantener mínimo; preferir crear un servicio en src/services/.
    const WHITELIST = new Set<string>([
      // Auth core — el cliente es parte del contrato de auth.
      "src/contexts/auth/useAuthSession.ts",
      "src/contexts/auth/useAuthProfile.ts",
      "src/contexts/AuthContext.tsx",
    ]);
    const pattern = /from\s+["']@\/integrations\/supabase\/client["']/;
    const all = [
      ...walk("src/hooks"),
      ...walk("src/contexts"),
      ...featureSubdirs("hooks").flatMap((d) => walk(d)),
    ];
    const violators = all.filter((f) => {
      if (WHITELIST.has(f.replace(/\\/g, "/"))) return false;
      const src = readFileSync(f, "utf8");
      return pattern.test(src);
    });
    expect(
      violators,
      `Hooks/contexts deben usar servicios en lugar del cliente Supabase directo:\n${violators.join("\n")}`,
    ).toEqual([]);
  });
});

