/**
 * La bandeja "Por enviar" ya NO se corta a 1000 filas mientras el badge
 * cuenta todo el universo: pagina con `.range()` y orden determinista
 * (fecha_emision desc + id) para que dos páginas no repitan ni omitan filas.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchFacturasPorEnviar,
  fetchIdsConEnvioExitoso,
  fetchIdsFacturasTimbradas,
} from "@/features/facturacion/services/bandejasQueries";

const fila = (id: string) => ({
  id, numero: `FAC-${id}`, cliente_id: "c1", cliente_nombre: "ACME",
  total: 100, moneda: "MXN", fecha_emision: "2026-01-01", uuid_fiscal: `uuid-${id}`,
});

beforeEach(() => {
  mock.resetResults();
  mock.tableCalls.length = 0;
});

describe("bandeja Por enviar · paginación", () => {
  it("trae más de 1000 filas paginando (no trunca la lista)", async () => {
    const pagina1 = Array.from({ length: 1000 }, (_, i) => fila(`a${i}`));
    const pagina2 = Array.from({ length: 25 }, (_, i) => fila(`b${i}`));
    mock.setTableResultOnce("facturas", { data: pagina1, error: null });
    mock.setTableResultOnce("facturas", { data: pagina2, error: null });
    mock.setTableResult("factura_envios", { data: [], error: null });

    const filas = await fetchFacturasPorEnviar("org1");
    expect(filas).toHaveLength(1025);
  });

  it("una factura con envío exitoso no reaparece en ninguna página", async () => {
    mock.setTableResultOnce("facturas", { data: [fila("1"), fila("2")], error: null });
    mock.setTableResult("factura_envios", { data: [{ factura_id: "2" }], error: null });

    const filas = await fetchFacturasPorEnviar("org1");
    expect(filas.map((f) => f.id)).toEqual(["1"]);
  });

  it("ordena por fecha_emision desc + id para páginas estables", async () => {
    mock.setTableResultOnce("facturas", { data: [fila("1")], error: null });
    mock.setTableResult("factura_envios", { data: [], error: null });
    await fetchFacturasPorEnviar("org1");

    const call = mock.tableCalls.find((c) => c.table === "facturas");
    const ordenArgs = (call?.opArgs ?? []).filter((_, i) => call?.ops[i] === "order");
    expect(ordenArgs[0]?.[0]).toBe("fecha_emision");
    expect(ordenArgs[1]?.[0]).toBe("id");
  });

  it("las consultas paginadas de IDs también ordenan por id", async () => {
    mock.setTableResult("factura_envios", { data: [{ factura_id: "x" }], error: null });
    mock.setTableResult("facturas", { data: [{ id: "y" }], error: null });
    await fetchIdsConEnvioExitoso("org1");
    await fetchIdsFacturasTimbradas("org1");

    for (const tabla of ["factura_envios", "facturas"]) {
      const call = mock.tableCalls.find((c) => c.table === tabla);
      const ordenArgs = (call?.opArgs ?? []).filter((_, i) => call?.ops[i] === "order");
      expect(ordenArgs.some((a) => a[0] === "id")).toBe(true);
    }
  });
});
