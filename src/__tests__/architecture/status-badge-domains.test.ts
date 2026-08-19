/**
 * Guardarraíl UI-1 / UI-3 (Ola B · auditoría externa 2026-08-19).
 *
 * 1. Los estados visuales se pintan SIEMPRE con `<StatusBadge />` + el
 *    `statusRegistry`; los archivos ya migrados no pueden volver a inventar
 *    clases de color propias.
 * 2. Los iconos de modo de transporte son componentes Lucide, no emojis.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { walkFiles } from "@/test/helpers/walkSource";

const MIGRADOS = [
  "src/features/facturacion/components/CfdiEstadoBadge.tsx",
  "src/features/facturacion/components/proformasColumns.tsx",
  "src/features/crm/routes/leadsColumns.tsx",
  "src/features/tesoreria/components/PanelConciliacionEstados.tsx",
];

/** Clases de color de estado escritas a mano (el registry es la única fuente). */
const COLOR_ADHOC = /(bg|text|border)-(success|destructive|warning|info)\//;

const EMOJIS_MODO = ["\u{1F6A2}", "\u{2708}", "\u{1F69B}", "\u{1F504}"];

describe("UI-1 · badges de estado unificados", () => {
  it.each(MIGRADOS)("%s no define clases de color de estado a mano", (rel) => {
    const src = readFileSync(rel, "utf8");
    const ofensores = src
      .split("\n")
      .filter((l) => COLOR_ADHOC.test(l) && !l.trimStart().startsWith("*"));
    expect(ofensores).toEqual([]);
  });

  it.each(MIGRADOS)("%s usa StatusBadge", (rel) => {
    expect(readFileSync(rel, "utf8")).toContain("StatusBadge");
  });
});

describe("UI-3 · sin emojis de modo de transporte", () => {
  it("ningún archivo de src usa emojis de barco/avión/camión", () => {
    const ofensores: string[] = [];
    for (const file of walkFiles("src")) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const src = readFileSync(file, "utf8");
      if (EMOJIS_MODO.some((e) => src.includes(e))) ofensores.push(file);
    }
    expect(ofensores).toEqual([]);
  });
});
