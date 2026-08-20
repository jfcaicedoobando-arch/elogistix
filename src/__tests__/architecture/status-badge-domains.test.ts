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
  // Ola 2 · RN-3 — badges de costeo, CxP y tesorería.
  "src/features/costeo/components/TarifaEstadoUnificado.tsx",
  "src/features/costeo/components/CartaGarantiaIndicator.tsx",
  "src/features/costeo/components/TarifaFila.tsx",
  "src/features/cxp/components/NcSatBadge.tsx",
  "src/features/tesoreria/components/DetallePagoSheet.parts.tsx",
];

/** Clases de color de estado escritas a mano (el registry es la única fuente). */
const COLOR_ADHOC = /(bg|text|border)-(success|destructive|warning|info)\//;

const EMOJIS_MODO = ["\u{1F6A2}", "\u{2708}", "\u{1F69B}", "\u{1F504}"];

/**
 * Ola E · V-10 — emojis y glifos decorativos en la UI. Se usan iconos Lucide
 * porque los emojis cambian de forma según el sistema operativo y no heredan
 * el color del tema.
 */
const GLIFOS_DECORATIVOS = [
  "\u{1F389}", // 🎉
  "\u{1F4E6}", // 📦
  "\u{26A0}",  // ⚠ / ⚠️
  "\u{2713}",  // ✓
  "\u{2717}",  // ✗
];

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

describe("V-10 · sin emojis ni glifos decorativos", () => {
  it("ningún archivo de src usa 🎉 📦 ⚠ ✓ ✗ en código", () => {
    const ofensores: string[] = [];
    for (const f of walk(join(ROOT, "src"), {
      excludeDirs: ["node_modules"],
      excludeFileRe: /status-badge-domains\.test\.ts$/,
    })) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const codigo = readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      if (GLIFOS_DECORATIVOS.some((g) => codigo.includes(g))) ofensores.push(relPath(ROOT, f));
    }
    expect(ofensores).toEqual([]);
  });
});
