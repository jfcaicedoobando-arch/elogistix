/**
 * Tanda 2 · hallazgo 4: el texto del buscador manual de embarques es DATO, no
 * sintaxis PostgREST. Comodines (`%`, `_`) se escapan y los reservados del
 * `.or()` (`,`, `(`, `)`, `"`) van entrecomillados.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { buscarEmbarquesPorTexto } from "../sugerirEmbarques";

function exprOr(): string {
  const call = mock.tableCalls.find((c) => c.table === "embarques");
  const idx = call!.ops.indexOf("or");
  return String(call!.opArgs[idx][0]);
}

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.setTableResult("embarques", { data: [], error: null });
});

describe("buscarEmbarquesPorTexto — escapado del término", () => {
  it("mantiene las 4 columnas de búsqueda", async () => {
    await buscarEmbarquesPorTexto("EXP", "org-1");
    const expr = exprOr();
    for (const col of ["expediente", "bl_master", "bl_house", "cliente_nombre"]) {
      expect(expr).toContain(`${col}.ilike.`);
    }
  });

  it("escapa el comodín %", async () => {
    await buscarEmbarquesPorTexto("100%", "org-1");
    expect(exprOr()).toContain("%100\\%%");
  });

  it("escapa el comodín _", async () => {
    await buscarEmbarquesPorTexto("EXP_1", "org-1");
    expect(exprOr()).toContain("%EXP\\_1%");
  });

  it("entrecomilla comas", async () => {
    await buscarEmbarquesPorTexto("ACME, S.A.", "org-1");
    expect(exprOr()).toContain('expediente.ilike."%ACME, S.A.%"');
  });

  it("entrecomilla paréntesis", async () => {
    await buscarEmbarquesPorTexto("ACME (MX)", "org-1");
    expect(exprOr()).toContain('expediente.ilike."%ACME (MX)%"');
  });

  it("duplica comillas dobles internas", async () => {
    await buscarEmbarquesPorTexto('EL "RAPIDO"', "org-1");
    expect(exprOr()).toContain('expediente.ilike."%EL ""RAPIDO""%"');
  });

  it("excluye embarques eliminados y conserva el filtro de estados", async () => {
    await buscarEmbarquesPorTexto("EXP", "org-1");
    const call = mock.tableCalls.find((c) => c.table === "embarques");
    expect(call?.ops).toContain("is");
    expect(call?.ops).toContain("not");
  });
});
