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
import { readFileSync } from "node:fs";
import { globSync } from "glob";

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

describe("arquitectura: DetailHeader canónico en páginas de detalle", () => {
  const files = globSync("src/features/**/routes/*Detalle*.tsx", { nodir: true });

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
});
