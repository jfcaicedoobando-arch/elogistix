/**
 * UI-15 · Guardrail: `formatCurrency*` con moneda explícita en features de dinero.
 *
 * `formatCurrency(amount, currency = 'MXN')` asume pesos cuando el call-site
 * omite la moneda. En una operación multi-moneda eso puede rotular un importe
 * en USD como MXN. En los features financieros la moneda debe ser explícita.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FEATURES_DINERO = [
  "embarques", "costeo", "cotizacion", "proformas",
  "facturacion", "cxp", "cxc", "crm", "tesoreria",
];

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...archivos(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Devuelve los argumentos top-level de cada llamada a formatCurrency*. */
function llamadasSinMoneda(src: string): number[] {
  const lineas: number[] = [];
  const re = /formatCurrency(?:Safe|Compact)?\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const inicio = i;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      i += 1;
    }
    const args = src.slice(inicio, i - 1);
    let nivel = 0;
    let comas = 0;
    for (const ch of args) {
      if (ch === "(" || ch === "[" || ch === "{") nivel += 1;
      else if (ch === ")" || ch === "]" || ch === "}") nivel -= 1;
      else if (ch === "," && nivel === 0) comas += 1;
    }
    if (comas === 0) lineas.push(src.slice(0, m.index).split("\n").length);
  }
  return lineas;
}

describe("UI-15 — moneda explícita en formatCurrency", () => {
  it("ningún call-site de features financieros omite la moneda", () => {
    const violaciones: string[] = [];
    for (const feature of FEATURES_DINERO) {
      const dir = join("src", "features", feature);
      let lista: string[];
      try {
        lista = archivos(dir);
      } catch {
        continue;
      }
      for (const file of lista) {
        const src = readFileSync(file, "utf8");
        for (const linea of llamadasSinMoneda(src)) {
          violaciones.push(`${file}:${linea}`);
        }
      }
    }
    expect(violaciones, `formatCurrency sin moneda explícita:\n${violaciones.join("\n")}`).toEqual([]);
  });
});
