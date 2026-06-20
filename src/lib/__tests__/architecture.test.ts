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
      "src/lib/contexts/auth/useAuthSession.ts",
      "src/lib/contexts/auth/useAuthProfile.ts",
      "src/lib/contexts/AuthContext.tsx",
    ]);
    const pattern = /from\s+["']@\/integrations\/supabase\/client["']/;
    const all = [
      ...walk("src/hooks"),
      ...walk("src/lib/contexts"),
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

  // Paso 4 del plan de auditoría: prohibir `as unknown as` sin justificación
  // fuera de src/lib y src/test. Permitido si la misma línea o la inmediata
  // anterior incluye el marcador `// SAFE-CAST:` (ver mem://principles/safe-cast).
  it("no hay `as unknown as` sin marcador SAFE-CAST fuera de src/lib y src/test", () => {
    const roots = ["src/components", "src/hooks", "src/services", "src/pages", "src/lib/contexts", "src/features"];
    const offenders: string[] = [];
    for (const root of roots) {
      let files: string[] = [];
      try { files = walk(root); } catch { continue; }
      for (const f of files) {
        const src = readFileSync(f, "utf8");
        const lines = src.split("\n");
        lines.forEach((line, idx) => {
          if (!/\bas\s+unknown\s+as\b/.test(line)) return;
          if (line.includes("SAFE-CAST")) return;
          // Buscar hacia arriba a través del bloque de comentarios `//` contiguo.
          let i = idx - 1;
          let marked = false;
          while (i >= 0 && /^\s*\/\//.test(lines[i])) {
            if (/SAFE-CAST:/.test(lines[i])) { marked = true; break; }
            i--;
          }
          if (!marked) offenders.push(`${f}:${idx + 1}`);
        });
      }
    }
    expect(
      offenders,
      `Casts \`as unknown as\` requieren marcador \`// SAFE-CAST:\` (ver mem://principles/safe-cast):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  // Paso 4 del plan de auditoría: no introducir nuevas carpetas de dominio en
  // src/{components,hooks,services,pages}/<dominio> cuando ya existe el
  // equivalente en src/features/<dominio>/. Fuerza la migración progresiva.
  it("no se duplican carpetas de dominio en src/{components,hooks,services} si existe src/features/<dominio> migrado", () => {
    // Allowlist: deuda histórica permitida hasta completar la migración del
    // dominio. Cada entrada debe removerse al mover los archivos a features/.
    const SHADOW_ALLOWLIST = new Set<string>([
      "src/services/embarques",
      // CRM: migración iterativa. v12.95.10 movió lib/crm → features/crm/domain.
      // Pasos 6+9 del plan migrarán services/components/hooks/pages a features/crm/.
      "src/components/crm",
      "src/hooks/crm",
      "src/services/crm",
    ]);
    let features: string[] = [];
    try {
      features = readdirSync("src/features").filter((d) => {
        try {
          if (!statSync(join("src/features", d)).isDirectory()) return false;
          // Saltar features que sólo contienen `queryKeys.ts` (migración parcial
          // de query keys, sin mover capas todavía).
          const contents = readdirSync(join("src/features", d));
          const real = contents.filter((c) => c !== "queryKeys.ts" && !c.startsWith("."));
          return real.length > 0;
        } catch { return false; }
      });
    } catch { /* features/ may not exist */ }
    const layers = ["components", "hooks", "services"] as const;
    const shadows: string[] = [];
    for (const dom of features) {
      for (const layer of layers) {
        const p = `src/${layer}/${dom}`;
        try {
          if (statSync(p).isDirectory() && !SHADOW_ALLOWLIST.has(p)) shadows.push(p);
        } catch { /* missing */ }
      }
    }
    expect(
      shadows,
      `Estas carpetas duplican un dominio ya migrado a src/features. Muévelas a features/<dominio>/<capa>/:\n${shadows.join("\n")}`,
    ).toEqual([]);
  });
});

