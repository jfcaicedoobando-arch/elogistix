/**
 * Blinda Fase 1 item #3: eliminada la feature cajón-de-sastre `misc`.
 * Verifica que la API pública de queryKeys quedó intacta.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";
import { queryKeys } from "@/lib/query";

const ROOT = process.cwd();

describe("Fase 1 #3 — sin features/misc", () => {
  it("el directorio src/features/misc/ no existe", () => {
    expect(existsSync(join(ROOT, "src/features/misc"))).toBe(false);
  });

  it("ningún archivo importa de @/features/misc/...", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "src"))) {
      const rel = relPath(ROOT, file);
      if (rel.endsWith("no-misc-feature.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      if (/from\s+["']@\/features\/misc(\/|["'])/.test(text)) {
        offenders.push(rel);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("API pública de queryKeys preservada (bitacora, trackingLinks, trackingPublico, clienteFinancials, pdfPreviewCotizacion)", () => {
    expect(queryKeys.bitacora).toBeDefined();
    expect(queryKeys.trackingLinks).toBeDefined();
    expect(queryKeys.trackingPublico).toBeDefined();
    expect(queryKeys.clienteFinancials).toBeDefined();
    expect(queryKeys.pdfPreviewCotizacion).toBeDefined();
  });
});
