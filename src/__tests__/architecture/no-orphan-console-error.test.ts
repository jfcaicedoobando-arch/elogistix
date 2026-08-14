/**
 * Guardrail (Ola 17 · v13.615.0): prohibido `console.error` huérfano en
 * `src/features/**` y `src/hooks/**`.
 *
 * Un `console.error` no lo ve el usuario ni soporte: el error se pierde. Todo
 * fallo debe ir por `notifyError` (toast con "Ver detalles" copiable) o, cuando
 * no hay superficie de UI, por `reportCaughtError` (Sentry).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import fg from "fast-glob";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

/** Módulos de observabilidad/logging donde `console.error` ES el destino. */
const ALLOWLIST = new Set<string>([]);

describe("console.error huérfano", () => {
  it("features y hooks no usan console.error", async () => {
    const files = await fg(["src/features/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"], {
      cwd: ROOT,
      ignore: ["src/**/__tests__/**", "src/**/*.test.*", "src/**/*.spec.*"],
    });
    const violators: string[] = [];
    for (const rel of files) {
      if (ALLOWLIST.has(rel)) continue;
      const src = readFileSync(path.join(ROOT, rel), "utf-8");
      if (/\bconsole\.error\s*\(/.test(src)) violators.push(rel);
    }
    expect(
      violators,
      `Usa notifyError(...) o reportCaughtError(...) en lugar de console.error: ${violators.join(", ")}`,
    ).toEqual([]);
  });
});
