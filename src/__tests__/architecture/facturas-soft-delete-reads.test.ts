/**
 * Guardrail (v13.520.0): toda LECTURA de `public.facturas` desde el frontend
 * debe excluir las facturas borradas lógicamente con `.is("deleted_at", null)`.
 *
 * Bug que motiva el test: la bandeja "Vencidas" mostraba 6 duplicados legacy
 * que ya tenían `deleted_at`, porque `fetchCobranza` filtraba por estado pero
 * no por borrado lógico.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..", "..");
const SRC = path.join(ROOT, "src");

/**
 * Lecturas por id/relación donde ver el registro borrado es intencional
 * (detalle histórico, sustitución, recálculos y flujos de escritura).
 */
const EXENTOS = new Set<string>([
  "src/features/facturacion/services/detail.ts",
  "src/features/facturacion/services/sustitucionEstado.ts",
  "src/features/facturacion/services/sustitutasDeFactura.ts",
  "src/features/facturacion/services/recalcularTotalesFactura.ts",
  "src/features/facturacion/services/repAutoEmail.ts",
  "src/features/facturacion/services/cobroFacturaMovimiento.ts",
  "src/features/facturacion/services/pagoClienteLote.ts",
  "src/features/facturacion/services/facturaManual.ts",
  "src/features/facturacion/services/masivas.ts",
  "src/features/facturacion/services/datosFiscalesCliente.ts",
  "src/features/facturacion/services/historialFactura.ts",
  // Refacturación: el asistente debe poder leer la factura original ya cancelada.
  "src/features/facturacion/services/refacturacion.ts",
  "src/features/proformas/services/facturar.ts",
  "src/services/storage/facturas.ts",
]);

function listarArchivos(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      listarArchivos(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Devuelve los bloques de query que arrancan en `.from("facturas")`. */
function bloquesDeLectura(fuente: string): string[] {
  // Quita comentarios de línea: un ";" dentro de un comentario cortaría el bloque.
  const src = fuente.replace(/\/\/[^\n]*/g, "");
  const bloques: string[] = [];
  const regex = /\.from\(\s*"facturas"\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(src)) !== null) {
    const antes = src.slice(Math.max(0, m.index - 30), m.index);
    if (antes.includes("storage")) continue; // bucket de archivos, no tabla
    const resto = src.slice(m.index);
    const fin = resto.indexOf(";");
    const bloque = fin === -1 ? resto : resto.slice(0, fin);
    if (/\.(update|insert|upsert|delete)\(/.test(bloque)) continue; // escritura
    bloques.push(bloque);
  }
  return bloques;
}

describe("lecturas de facturas excluyen borradas lógicamente", () => {
  const archivos = listarArchivos(SRC)
    .filter((f) => !f.includes("integrations/supabase/types"))
    .map((f) => path.relative(ROOT, f));

  it("no hay lecturas de facturas sin filtro de deleted_at", () => {
    const infractores: string[] = [];
    for (const rel of archivos) {
      if (EXENTOS.has(rel)) continue;
      const src = readFileSync(path.join(ROOT, rel), "utf-8");
      for (const bloque of bloquesDeLectura(src)) {
        if (!/\.is\(\s*"deleted_at"\s*,\s*null\s*\)/.test(bloque)) {
          infractores.push(rel);
          break;
        }
      }
    }
    expect(
      infractores,
      `Agrega .is("deleted_at", null) o registra el archivo en EXENTOS: ${infractores.join(", ")}`,
    ).toEqual([]);
  });
});
