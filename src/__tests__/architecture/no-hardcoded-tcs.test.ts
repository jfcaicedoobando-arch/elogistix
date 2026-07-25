import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import fg from "fast-glob";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

describe("Arquitectura: Sin TCs hardcodeados", () => {
  it("ningún archivo en cxp o compras contiene multiplicadores literales de TC (ej. * 20)", async () => {
    const files = await fg(["src/features/cxp/**/*.{ts,tsx}", "src/features/compras/**/*.{ts,tsx}"], {
      cwd: ROOT,
      ignore: ["**/__tests__/**", "**/*.test.*", "**/*.spec.*"],
    });
    
    const violators: string[] = [];
    const pattern = /[*/+-]\s*20\b|\b20\s*[*/+-]/;

    for (const rel of files) {
      const src = readFileSync(path.join(ROOT, rel), "utf-8");
      if (pattern.test(src)) {
        // Excluimos falsos positivos si los hay, pero el patrón es específico para operaciones con 20
        violators.push(rel);
      }
    }
    
    expect(violators, `Se encontraron posibles TCs hardcodeados (20) en: ${violators.join(", ")}. Usa tipo_cambio_usd de la factura o el servicio Banxico.`).toEqual([]);
  });
});
