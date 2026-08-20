/**
 * Guardrail V-1 (Ola E · auditoría visual) — escala tipográfica semántica.
 *
 * El contrato tipográfico del ERP vive en `tailwind.config.ts`:
 *   text-body     → cuerpo por defecto (14 px)
 *   text-body-sm  → cuerpo denso: celdas, listas compactas (13 px)
 *   text-label    → micro-copy, chips y badges (11 px)
 *
 * Los módulos ya migrados no pueden reintroducir los escalones crudos de
 * Tailwind (`text-sm` / `text-xs`), porque son los que hacían que el mismo rol
 * de texto se viera distinto entre pantallas.
 *
 * Cómo crecer: al migrar un módulo nuevo, agrégalo a `MODULOS_MIGRADOS`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

/** Módulos con contrato tipográfico ya homologado (sólo puede crecer). */
const MODULOS_MIGRADOS: readonly string[] = [
  "src/features/embarques",
  "src/features/facturacion",
  "src/features/tesoreria",
  "src/features/portal",
  "src/features/crm",
  "src/features/dashboard",
  "src/features/dashboardEjecutivo",
  "src/features/cxp",
  "src/features/cotizacion",
  "src/features/admin",
  "src/features/auditoria",
  "src/features/proformas",
  "src/features/costeo",
  "src/features/proveedor",
  // Ola C · C.1 — primitivas compartidas selladas: un badge y su celda vecina
  // ya no pueden tener el mismo rol con distinta fuente.
  "src/components/shared",
  "src/components/ui",

];

/** Escalones crudos de Tailwind prohibidos en los módulos migrados. */
const CRUDO = /\btext-(sm|xs)\b/;

describe("architecture — tipografía semántica (V-1)", () => {
  it.each(MODULOS_MIGRADOS)("%s no usa text-sm ni text-xs", (modulo) => {
    const violaciones: string[] = [];
    for (const f of walk(join(ROOT, modulo), {
      excludeDirs: ["__tests__", "node_modules"],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
    })) {
      if (!f.endsWith(".tsx")) continue;
      const lineas = readFileSync(f, "utf8").split("\n");
      for (let i = 0; i < lineas.length; i++) {
        if (CRUDO.test(lineas[i])) {
          violaciones.push(`${relPath(ROOT, f)}:${i + 1}`);
        }
      }
    }
    expect(
      violaciones,
      "Escalones crudos de Tailwind detectados. Usa text-body (cuerpo),\n" +
        "text-body-sm (denso) o text-label (micro-copy).\n\n" +
        violaciones.join("\n"),
    ).toEqual([]);
  });
});
