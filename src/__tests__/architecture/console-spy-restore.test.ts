/**
 * Guardrail: un `vi.spyOn(console, ...)` que no se restaura silencia los logs
 * de las pruebas siguientes y puede esconder fallos reales. Todo archivo de
 * prueba que espíe consola debe restaurar (`mockRestore`, `restoreAllMocks`,
 * `restoreMocks: true` en config global) o usar el helper
 * `silenciarLogEsperado`, que restaura por contrato.
 *
 * Además verifica en caliente que consola NO está espiada en este archivo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import fg from "fast-glob";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const SPY_RE = /vi\.spyOn\(\s*console\s*,/;
const RESTAURA_RE = /mockRestore\s*\(|restoreAllMocks\s*\(|silenciarLogEsperado\s*\(/;

describe("spies de consola en pruebas", () => {
  it("todo archivo que espía consola la restaura", async () => {
    const files = await fg(["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"], { cwd: ROOT });
    const violadores: string[] = [];
    for (const rel of files) {
      const src = readFileSync(path.join(ROOT, rel), "utf-8");
      if (!SPY_RE.test(src)) continue;
      if (!RESTAURA_RE.test(src)) violadores.push(rel);
    }
    expect(
      violadores,
      `Restaura el spy de consola (mockRestore/restoreAllMocks) o usa silenciarLogEsperado: ${violadores.join(", ")}`,
    ).toEqual([]);
  });

  it("consola no llega espiada desde otro archivo de prueba", () => {
    const sospechosos = (["log", "info", "warn", "error", "debug"] as const).filter(
      (m) => "mock" in (console[m] as unknown as Record<string, unknown>),
    );
    expect(sospechosos, "Un spy de consola quedó activo entre pruebas").toEqual([]);
  });
});
