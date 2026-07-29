/**
 * Guardrail v13.301.62: cualquier servicio de reportería que lea `from("facturas")`
 * debe filtrar por estados vivos (excluir `Cancelada` y `Sustituida`). El listado
 * maestro, exportaciones contables y acciones masivas por-ID están explícitamente
 * excluidos porque tienen políticas distintas.
 *
 * Si alguien agrega un nuevo reporte que consulte `facturas`, este test lo obliga
 * a filtrar por `estado`. Ver `src/features/facturacion/domain/estadosFactura.ts`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPORTES_FILES = [
  "src/features/facturacion/services/dashboardEjecutivo.ts",
  "src/features/facturacion/services/cobranza.ts",
  "src/features/facturacion/estadoCuenta/services/estadoCuenta.ts",
  "src/features/facturacion/services/huecoFacturacion/fetchSources.ts",
  "src/features/profit/services/estadoResultadosDevengado.ts",
  "src/features/portal/services/queries.ts",
  "src/features/cliente/services/financials.ts",
];

const ESTADOS_MUERTOS = ["Cancelada", "Sustituida"];

describe("Reportes de facturas · guardrail estados vivos", () => {
  for (const relPath of REPORTES_FILES) {
    it(`${relPath} filtra por estado (excluye Cancelada/Sustituida)`, () => {
      const src = readFileSync(resolve(process.cwd(), relPath), "utf-8");
      // FIX C3c: si el servicio ya no lee `facturas` desde el cliente porque
      // delega la agregación a una RPC server-side, el filtro de estados vive
      // en SQL y este guardrail no aplica.
      const delegaEnRpc = /supabase\.rpc\(/.test(src) && !/from\(\s*["']facturas["']/.test(src);
      // Debe existir al menos una restricción por estado sobre la tabla facturas.
      const filtraPorEstado =
        delegaEnRpc ||
        /\.in\(\s*["']estado["']/.test(src) ||
        /\.eq\(\s*["']estado["']/.test(src) ||
        /facturas\.estado/.test(src) ||
        /\.neq\(\s*["']estado["']/.test(src);
      expect(filtraPorEstado, `${relPath} debe filtrar por estado`).toBe(true);
      // No debe listar explícitamente Cancelada ni Sustituida como estado válido.
      for (const dead of ESTADOS_MUERTOS) {
        const regexIn = new RegExp(`\\.in\\(\\s*["']estado["'][^)]*["']${dead}["']`);
        expect(regexIn.test(src), `${relPath} no debe incluir "${dead}" en .in(estado, …)`).toBe(false);
      }
    });
  }
});
