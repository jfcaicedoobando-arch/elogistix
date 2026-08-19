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
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

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
    const src = readFileSync(join(ROOT, rel), "utf8");
    const ofensores = src
      .split("\n")
      .filter((l) => COLOR_ADHOC.test(l) && !l.trimStart().startsWith("*"));
    expect(ofensores).toEqual([]);
  });

  it.each(MIGRADOS)("%s usa StatusBadge", (rel) => {
    expect(readFileSync(join(ROOT, rel), "utf8")).toContain("StatusBadge");
  });
});

describe("UI-3 · sin emojis de modo de transporte", () => {
  it("ningún archivo de src usa emojis de barco/avión/camión", () => {
    const ofensores: string[] = [];
    for (const f of walk(join(ROOT, "src"), {
      excludeDirs: ["node_modules"],
      excludeFileRe: /status-badge-domains\.test\.ts$/,
    })) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const src = readFileSync(f, "utf8");
      // Se ignoran comentarios: documentar el emoji retirado es válido.
      const codigo = src
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      if (EMOJIS_MODO.some((e) => codigo.includes(e))) ofensores.push(relPath(ROOT, f));
    }
    expect(ofensores).toEqual([]);
  });
});
