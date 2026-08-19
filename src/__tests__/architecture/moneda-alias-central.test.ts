/**
 * Ola 19 · pasos 2 y 5 — guardrails de organización.
 *
 * 1. `profit` no puede importar de `dashboardEjecutivo`: la dirección permitida
 *    es dashboardEjecutivo → profit. Así no vuelve el ciclo de dependencias.
 * 2. Ningún módulo de producción vuelve a declarar la unión de tres monedas
 *    (`"MXN" | "USD" | "EUR"`); debe usar el alias central `Moneda` de
 *    `@/types/db`, derivado del enum de la base.
 */
import { describe, it, expect } from "vitest";
import fg from "fast-glob";
import { readFileSync } from "node:fs";

/** Archivos generados o de datos de prueba que no participan del contrato. */
const EXENTOS = [
  "src/integrations/supabase/types.ts",
  "src/types/db.ts",
];

function archivosProduccion(): string[] {
  return fg.sync(["src/**/*.{ts,tsx}"], {
    ignore: [
      "src/**/__tests__/**",
      "src/**/*.test.{ts,tsx}",
      "src/lib/e2e/**",
      ...EXENTOS,
    ],
  });
}

describe("arquitectura · Moneda y ciclo profit ↔ dashboardEjecutivo", () => {
  it("profit no importa de dashboardEjecutivo", () => {
    const ofensores = fg
      .sync(["src/features/profit/**/*.{ts,tsx}"])
      .filter((f) => readFileSync(f, "utf8").includes("@/features/dashboardEjecutivo"));
    expect(ofensores).toEqual([]);
  });

  it("nadie redeclara la unión literal de tres monedas", () => {
    const patron = /(["'])(MXN|USD|EUR)\1\s*\|\s*(["'])(MXN|USD|EUR)\3\s*\|\s*(["'])(MXN|USD|EUR)\5/;
    const ofensores = archivosProduccion().filter((f) => patron.test(readFileSync(f, "utf8")));
    expect(ofensores).toEqual([]);
  });
});
