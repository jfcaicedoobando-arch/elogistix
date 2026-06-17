/**
 * Blinda Fase 1 item #5: ningún cast HIGH/CRITICAL en
 * `src/features/**\/services/**` sin marcador `// SAFE-CAST:`.
 */
import { describe, it, expect } from "vitest";
import { scanCasts } from "../../../scripts/lib/casts";

describe("Fase 1 #5 — casts en servicios de features", () => {
  it("0 casts HIGH o CRITICAL en src/features/**/services/**", () => {
    const hits = scanCasts(process.cwd()).filter(
      (h) =>
        /^src\/features\/[^/]+\/services\//.test(h.file) &&
        (h.severity === "HIGH" || h.severity === "CRITICAL"),
    );
    const detail = hits.map((h) => `  ${h.file}:${h.line} [${h.severity}] ${h.snippet}`).join("\n");
    expect(hits.length, `Casts sin SAFE-CAST:\n${detail}`).toBe(0);
  });

  it("auditoría global sigue en 0 HIGH/CRITICAL", () => {
    const all = scanCasts(process.cwd());
    const dangerous = all.filter((h) => h.severity === "HIGH" || h.severity === "CRITICAL");
    expect(dangerous.length).toBe(0);
  });
});
