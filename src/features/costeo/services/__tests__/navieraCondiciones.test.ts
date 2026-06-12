import { describe, it, expect, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchCondicionesNaviera,
  upsertCondicionNaviera,
  deleteCondicionNaviera,
  fetchDemorasTramos,
  replaceDemorasTramos,
  fetchTiposContenedorParaDemoras,
  fetchNavierasCatalogo,
} from "../navieraCondiciones";

const ORG = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("costeo/services/navieraCondiciones", () => {
  it("fetchCondicionesNaviera aplana naviera y proveedor", async () => {
    mock.setTableResult("costeo_navieras_condiciones", {
      data: [
        {
          id: "c1",
          naviera_id: "n1",
          naviera: { name: "MSC", code: "MSCU" },
          proveedor: { nombre: "Proveedor X" },
        },
      ],
      error: null,
    });
    const res = await fetchCondicionesNaviera(ORG);
    expect(res[0].naviera_nombre).toBe("MSC");
    expect(res[0].naviera_code).toBe("MSCU");
    expect(res[0].proveedor_nombre).toBe("Proveedor X");
  });

  it("upsertCondicionNaviera limpia campos de carta garantía cuando tiene_carta_garantia=false", async () => {
    mock.setTableResult("costeo_navieras_condiciones", { data: { id: "c2" }, error: null });
    await upsertCondicionNaviera(ORG, {
      naviera_id: "n1",
      proveedor_id: "p1",
      tiene_carta_garantia: false,
      carta_garantia_vigente_hasta: "2026-12-31",
      carta_garantia_folio: "F-001",
      carta_garantia_notas: null,
      dias_libres_demoras_default: 7,
      moneda_demoras: "USD",
      notas: null,
    });
    const payload = mock.getMutationPayload("costeo_navieras_condiciones", "insert") as Record<string, unknown>;
    expect(payload.carta_garantia_vigente_hasta).toBeNull();
    expect(payload.carta_garantia_folio).toBeNull();
  });

  it("upsertCondicionNaviera con id existente hace update", async () => {
    mock.setTableResult("costeo_navieras_condiciones", { data: { id: "c3" }, error: null });
    await upsertCondicionNaviera(
      ORG,
      {
        naviera_id: "n1",
        proveedor_id: "p1",
        tiene_carta_garantia: true,
        carta_garantia_vigente_hasta: "2027-01-01",
        carta_garantia_folio: "F-002",
        carta_garantia_notas: "ok",
        dias_libres_demoras_default: 14,
        moneda_demoras: "USD",
        notas: null,
      },
      "c3",
    );
    const call = mock.tableCalls.find((c) => c.table === "costeo_navieras_condiciones");
    expect(call?.ops).toContain("update");
  });

  it("deleteCondicionNaviera ejecuta delete con eq id", async () => {
    mock.setTableResult("costeo_navieras_condiciones", { data: null, error: null });
    await deleteCondicionNaviera("c1");
    const call = mock.tableCalls.find((c) => c.table === "costeo_navieras_condiciones");
    expect(call?.ops).toContain("delete");
  });

  it("fetchDemorasTramos ordena por tipo_contenedor_id y desde_dia", async () => {
    mock.setTableResult("costeo_naviera_demoras_tarifa", { data: [{ id: "t1" }], error: null });
    await fetchDemorasTramos("c1");
    const call = mock.tableCalls.find((c) => c.table === "costeo_naviera_demoras_tarifa");
    const orderCount = call?.ops.filter((o) => o === "order").length ?? 0;
    expect(orderCount).toBe(2);
  });

  it("replaceDemorasTramos primero borra y luego inserta los tramos nuevos", async () => {
    mock.setTableResult("costeo_naviera_demoras_tarifa", { data: null, error: null });
    await replaceDemorasTramos("c1", "tc", [
      { desde_dia: 1, hasta_dia: 5, monto_por_dia: 100, moneda: "USD" },
      { desde_dia: 6, hasta_dia: null, monto_por_dia: 150, moneda: "USD" },
    ]);
    const calls = mock.tableCalls.filter((c) => c.table === "costeo_naviera_demoras_tarifa");
    expect(calls[0].ops).toContain("delete");
    expect(calls[1].ops).toContain("insert");
    const payload = mock.getMutationPayload("costeo_naviera_demoras_tarifa", "insert") as unknown[];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(2);
  });

  it("replaceDemorasTramos no inserta cuando tramos está vacío", async () => {
    mock.setTableResult("costeo_naviera_demoras_tarifa", { data: null, error: null });
    await replaceDemorasTramos("c1", "tc", []);
    const calls = mock.tableCalls.filter((c) => c.table === "costeo_naviera_demoras_tarifa");
    expect(calls).toHaveLength(1);
    expect(calls[0].ops).toContain("delete");
  });

  it("fetchTiposContenedorParaDemoras filtra códigos relevantes", async () => {
    mock.setTableResult("tipos_contenedor", { data: [{ id: "tc", code: "40HC", name: "40 High Cube" }], error: null });
    await fetchTiposContenedorParaDemoras();
    const call = mock.tableCalls.find((c) => c.table === "tipos_contenedor");
    expect(call?.ops).toContain("in");
  });

  it("fetchNavierasCatalogo solo trae activas", async () => {
    mock.setTableResult("navieras", { data: [{ id: "n1", name: "MSC", code: "MSCU" }], error: null });
    await fetchNavierasCatalogo();
    const call = mock.tableCalls.find((c) => c.table === "navieras");
    expect(call?.ops).toContain("eq");
  });
});
