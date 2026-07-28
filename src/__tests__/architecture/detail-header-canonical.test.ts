/**
 * Guardrail de arquitectura — Encabezados de páginas de detalle.
 *
 * Las páginas de detalle deben usar el componente canónico `DetailHeader`
 * (que ya incluye el botón "Volver" como enlace real) en lugar de
 * reimplementar el patrón "ghost button + ArrowLeft + navigate".
 *
 * Analogía: un solo recepcionista con el mismo guion para todas las fichas.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

/** Recorrido recursivo sin dependencias externas (evita `glob`). */
function listarRutasDetalle(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listarRutasDetalle(full));
    } else if (
      entry.isFile() &&
      entry.name.includes("Detalle") &&
      entry.name.endsWith(".tsx") &&
      dir.endsWith("/routes")
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Archivos que legítimamente pueden dibujar un ArrowLeft propio. */
const ALLOWLIST = [
  "src/components/shared/DetailHeader.tsx",
  "src/components/shared/WizardShell.tsx",
  "src/features/auth/routes/NotFound.tsx",
  "src/features/legal/routes/Terminos.tsx",
  "src/features/legal/routes/Seguridad.tsx",
  "src/features/legal/routes/Privacidad.tsx",
];

/** Wizards y diálogos usan ArrowLeft para navegar entre pasos, no para volver. */
const STEP_NAV_PATTERN = /(Wizard|Dialog|Stepper|Shortcuts)/;

/** Rutas que no son fichas de entidad (estados de error/vacío, contenedores). */
const NO_ES_DETALLE = ["src/features/embarques/routes/EmbarqueDetalleStates.tsx"];

describe("arquitectura: DetailHeader canónico en páginas de detalle", () => {
  const files = listarRutasDetalle("src/features");

  it("encuentra rutas de detalle para auditar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s no reimplementa el botón Volver con ArrowLeft", (file) => {
    if (ALLOWLIST.includes(file) || STEP_NAV_PATTERN.test(file)) return;
    const src = readFileSync(file, "utf8");
    const usaArrowLeft = /\bArrowLeft\b/.test(src);
    expect(
      usaArrowLeft,
      `${file} usa ArrowLeft directamente. Usa <DetailHeader backTo="..."> en su lugar.`,
    ).toBe(false);
  });

  /** Resuelve imports `@/...` y relativos a rutas de archivo reales. */
  function resolverImport(desde: string, spec: string): string | null {
    const base = spec.startsWith("@/")
      ? spec.replace("@/", "src/")
      : spec.startsWith(".")
        ? join(dirname(desde), spec)
        : null;
    if (!base) return null;
    for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
      if (existsSync(base + ext)) return base + ext;
    }
    return existsSync(base) ? base : null;
  }

  /** ¿El archivo (o alguno de sus imports locales, hasta `profundidad`) usa DetailHeader? */
  function usaDetailHeader(file: string, profundidad = 2, visto = new Set<string>()): boolean {
    if (visto.has(file) || profundidad < 0) return false;
    visto.add(file);
    const src = readFileSync(file, "utf8");
    if (/\bDetailHeader\b/.test(src)) return true;
    const specs = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    return specs.some((spec) => {
      const resuelto = resolverImport(file, spec);
      return resuelto ? usaDetailHeader(resuelto, profundidad - 1, visto) : false;
    });
  }

  it.each(files)("%s usa DetailHeader (directo o vía su componente de header)", (file) => {
    if (NO_ES_DETALLE.includes(file) || STEP_NAV_PATTERN.test(file)) return;
    expect(
      usaDetailHeader(file),
      `${file} no usa DetailHeader ni delega en un componente que lo use.`,
    ).toBe(true);
  });

});

