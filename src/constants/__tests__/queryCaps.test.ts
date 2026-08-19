/**
 * Guardrail (paso 7 de la auditoría): los topes grandes de consulta deben venir
 * de `src/constants/queryCaps.ts`, no escritos a mano en cada servicio.
 *
 * Se permiten números chicos (paginación de pantalla, `.limit(1)`, top-N), porque
 * ahí el número *es* la intención de la UI y no un cap defensivo.
 */
import { readFileSync } from "node:fs";
import fg from "fast-glob";
import { describe, expect, it } from "vitest";
import { CAP_LISTA, CAP_POSTGREST, CAP_REPORTE, CAP_REPORTE_AMPLIO } from "../queryCaps";

const UMBRAL_CAP = 500;

describe("topes de consulta centralizados", () => {
  it("los caps tienen valores crecientes y estables", () => {
    expect([CAP_LISTA, CAP_POSTGREST, CAP_REPORTE, CAP_REPORTE_AMPLIO]).toEqual([500, 1000, 2000, 5000]);
  });

  it("ningún servicio escribe .limit(>=500) con número literal", async () => {
    const archivos = await fg(["src/**/*.ts", "src/**/*.tsx"], {
      ignore: ["src/**/__tests__/**", "src/**/*.test.ts", "src/**/*.test.tsx", "src/constants/queryCaps.ts"],
    });
    const ofensores: string[] = [];
    for (const archivo of archivos) {
      const src = readFileSync(archivo, "utf8");
      for (const m of src.matchAll(/\.limit\((\d+)\)/g)) {
        if (Number(m[1]) >= UMBRAL_CAP) ofensores.push(`${archivo} → .limit(${m[1]})`);
      }
    }
    expect(ofensores).toEqual([]);
  });
});
