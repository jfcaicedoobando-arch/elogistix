import { describe, it, expect, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchDiagnosticoTarifas } from "../diagnosticoTarifas";

const base = {
  puertoOrigenId: "po",
  puertoDestinoId: "pd",
  tipoContenedorIds: ["tc-1", "tc-2"],
  hoy: "2026-09-02",
  organizationId: "org-1",
};

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("fetchDiagnosticoTarifas", () => {
  it("devuelve 'ninguna' cuando no existe ninguna tarifa", async () => {
    mock.setTableResult("costeo_tarifas", { data: [], error: null });
    expect(await fetchDiagnosticoTarifas(base)).toBe("ninguna");
  });

  it("devuelve 'pendiente' cuando hay una tarifa en borrador", async () => {
    mock.setTableResult("costeo_tarifas", {
      data: [{ estado_aprobacion: "borrador", vigente_hasta: "2026-12-31" }],
      error: null,
    });
    expect(await fetchDiagnosticoTarifas(base)).toBe("pendiente");
  });

  it("devuelve 'vencida' cuando todas las aprobadas ya caducaron", async () => {
    mock.setTableResult("costeo_tarifas", {
      data: [{ estado_aprobacion: "aprobada", vigente_hasta: "2026-08-01" }],
      error: null,
    });
    expect(await fetchDiagnosticoTarifas(base)).toBe("vencida");
  });

  it("ignora las rechazadas", async () => {
    mock.setTableResult("costeo_tarifas", {
      data: [{ estado_aprobacion: "rechazada", vigente_hasta: "2026-08-01" }],
      error: null,
    });
    expect(await fetchDiagnosticoTarifas(base)).toBe("ninguna");
  });
});
