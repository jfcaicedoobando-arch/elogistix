/**
 * Guardrail (13.68.3): todo toast de ERROR debe usar `notifyError` para que
 * lleve el botón "Ver detalles" → Copiar reporte / Copiar JSON. Prohibido:
 *
 *   - `toast.error("…")` directo de sonner
 *   - `toast({ ..., variant: "destructive" })` (shim legacy)
 *
 * Toasts de éxito (`toast.success`, `notifySuccess`) y warning (`toast.warning`,
 * `notifyWarning`) NO están restringidos.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { glob } from "glob";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

/** Archivos exentos por diseño (helpers y shim). */
const ALLOWLIST = new Set<string>([
  "src/components/shared/utils/appFeedback.ts",
  "src/hooks/shared/useToast.ts",
  "src/components/ui/ErrorDetailsDialog.tsx",
  "src/components/ui/sonner.tsx",
  "src/lib/observability/reportCaughtError.ts",
]);

describe("Error toasts deben usar notifyError", () => {
  it("nadie llama a toast.error(...) directo", async () => {
    const files = await glob(["src/**/*.ts", "src/**/*.tsx"], {
      cwd: ROOT,
      ignore: ["src/**/__tests__/**", "src/**/*.test.*", "src/**/*.spec.*"],
    });
    const violators: string[] = [];
    for (const rel of files) {
      if (ALLOWLIST.has(rel)) continue;
      const src = readFileSync(path.join(ROOT, rel), "utf-8");
      // toast.error( pero no toast.error.dismiss u otros encadenados
      if (/\btoast\.error\s*\(/.test(src)) {
        violators.push(rel);
      }
    }
    expect(violators, `Usa notifyError({...error, method}) en lugar de toast.error(): ${violators.join(", ")}`).toEqual([]);
  });

  it("nadie pasa variant: 'destructive' a toast()", async () => {
    const files = await glob(["src/**/*.ts", "src/**/*.tsx"], {
      cwd: ROOT,
      ignore: ["src/**/__tests__/**", "src/**/*.test.*", "src/**/*.spec.*"],
    });
    const violators: string[] = [];
    for (const rel of files) {
      if (ALLOWLIST.has(rel)) continue;
      const src = readFileSync(path.join(ROOT, rel), "utf-8");
      // Buscar `variant: "destructive"` SOLO si está acompañado de `toast(` cercano
      // (para no flagear botones con buttonVariants({ variant: "destructive" })).
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!/variant\s*:\s*["']destructive["']/.test(line)) continue;
        // Mirar 4 líneas atrás y la actual por `toast(`
        const ctx = lines.slice(Math.max(0, i - 4), i + 1).join("\n");
        if (/\btoast\s*\(\s*\{/.test(ctx)) {
          violators.push(`${rel}:${i + 1}`);
        }
      }
    }
    expect(violators, `Usa notifyError({...}) en lugar de toast({ variant: "destructive" }): ${violators.join(", ")}`).toEqual([]);
  });
});
