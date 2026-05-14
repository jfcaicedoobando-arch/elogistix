import { describe, it, expect } from "vitest";
import { recentChangelog, dedupeByVersion, type ChangelogEntry } from "../changelogData";
import { chunk0 } from "../changelog/v8/chunks/0";
import { chunk1 } from "../changelog/v8/chunks/1";
import { chunk2 } from "../changelog/v8/chunks/2";
import { chunk3 } from "../changelog/v8/chunks/3";
import { chunk4 } from "../changelog/v8/chunks/4";
import { chunk5 } from "../changelog/v8/chunks/5";
import { chunk6 } from "../changelog/v8/chunks/6";
import { APP_VERSION } from "@/constants/appVersion";

const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseSemver(v: string): [number, number, number] {
  const [a, b, c] = v.split("-")[0].split(".").map((n) => parseInt(n, 10));
  return [a, b, c];
}

function cmpSemver(a: string, b: string): number {
  const [a1, a2, a3] = parseSemver(a);
  const [b1, b2, b3] = parseSemver(b);
  return a1 !== b1 ? b1 - a1 : a2 !== b2 ? b2 - a2 : b3 - a3;
}

const v8All: ChangelogEntry[] = [...chunk0, ...chunk1, ...chunk2, ...chunk3, ...chunk4, ...chunk5, ...chunk6];

describe("changelog integrity", () => {
  it("recentChangelog tiene como máximo 10 entradas (mantener bundle pequeño)", () => {
    expect(recentChangelog.length).toBeLessThanOrEqual(10);
    expect(recentChangelog.length).toBeGreaterThan(0);
  });

  it("APP_VERSION coincide con la entrada más reciente de recentChangelog", () => {
    expect(recentChangelog[0].version).toBe(APP_VERSION);
  });

  it("APP_VERSION coincide con la entrada más reciente de chunk0", () => {
    expect(chunk0[0].version).toBe(APP_VERSION);
  });

  it("todas las versiones son semver válido", () => {
    for (const e of [...recentChangelog, ...v8All]) {
      expect(e.version, `version inválida: ${e.version}`).toMatch(SEMVER_RE);
    }
  });

  it("todas las fechas son ISO (YYYY-MM-DD)", () => {
    for (const e of [...recentChangelog, ...v8All]) {
      expect(e.date, `fecha inválida en v${e.version}: ${e.date}`).toMatch(ISO_DATE_RE);
      expect(Number.isNaN(new Date(e.date).getTime())).toBe(false);
    }
  });

  it("type es válido (major|minor|patch)", () => {
    for (const e of [...recentChangelog, ...v8All]) {
      expect(["major", "minor", "patch"]).toContain(e.type);
    }
  });

  it("title y description no están vacíos", () => {
    for (const e of [...recentChangelog, ...v8All]) {
      expect(e.title.trim().length, `title vacío en v${e.version}`).toBeGreaterThan(0);
      expect(e.description.trim().length, `description vacía en v${e.version}`).toBeGreaterThan(0);
    }
  });

  it("v8 chunks no tienen versiones duplicadas internamente", () => {
    const versions = v8All.map((e) => e.version);
    const unique = new Set(versions);
    expect(versions.length).toBe(unique.size);
  });

  it("recentChangelog no tiene versiones duplicadas internamente", () => {
    const versions = recentChangelog.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("chunk0 contiene todas las entradas de recentChangelog (chunk0 es fuente de verdad)", () => {
    const chunk0Versions = new Set(chunk0.map((e) => e.version));
    for (const e of recentChangelog) {
      expect(chunk0Versions.has(e.version), `v${e.version} falta en chunk0`).toBe(true);
    }
  });

  it("chunk0 está ordenado descendente por semver", () => {
    for (let i = 1; i < chunk0.length; i++) {
      expect(cmpSemver(chunk0[i - 1].version, chunk0[i].version)).toBeLessThanOrEqual(0);
    }
  });

  it("dedupeByVersion elimina duplicados conservando primera ocurrencia", () => {
    const merged = dedupeByVersion([...recentChangelog, ...v8All]);
    const versions = merged.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
    // recentChangelog gana (su descripción/summary se conserva)
    const recentTop = recentChangelog[0];
    const dedupedTop = merged.find((e) => e.version === recentTop.version);
    expect(dedupedTop?.title).toBe(recentTop.title);
  });
});
