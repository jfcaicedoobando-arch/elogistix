import { expect, it, vi } from "vitest";
import { fetchPagosRepPendientes } from "../bandejasQueries";

const fetchMock = vi.hoisted(() => vi.fn<typeof globalThis.fetch>());
vi.mock("@/integrations/supabase/client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient("https://audit.invalid", "synthetic-placeholder", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchMock },
    }),
  };
});

const params = {
  search: "ACME, S.A.",
  filters: { estado: "Error" },
  dateFrom: "2026-01-01",
  dateTo: "",
  sortKey: "factura",
  sortDir: "asc" as const,
  range: { from: 500, to: 519 },
  page: 25,
  pageSize: 20,
};

it("aplica búsqueda, estado, orden y rango al servidor y devuelve el total filtrado", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{
    id: "rep-501", factura_id: "factura", fecha_pago: "2026-10-10", monto: 100, moneda: "MXN",
    estado_rep: "Error", facturas: { numero: "F-501", cliente_nombre: "ACME, S.A." },
  }]), { headers: { "content-type": "application/json", "content-range": "500-500/624" } }));
  const result = await fetchPagosRepPendientes("org-a", params);
  expect(result).toMatchObject({ count: 624, rows: [{ id: "rep-501", factura_numero: "F-501" }] });
  const [input, init] = fetchMock.mock.calls.at(-1)!;
  const query = new URL(String(input)).searchParams;
  expect(query.get("select")).toContain("facturas!inner");
  expect(query.get("organization_id")).toBe("eq.org-a");
  expect(query.get("deleted_at")).toBe("is.null");
  expect(query.getAll("estado_rep")).toEqual(["in.(Pendiente,Error)", "eq.Error"]);
  expect(query.get("fecha_pago")).toBe("gte.2026-01-01");
  expect(query.get("facturas.or")).toBe('(numero.ilike."%ACME, S.A.%",cliente_nombre.ilike."%ACME, S.A.%")');
  expect(query.get("order")).toBe("facturas(numero).asc,id.asc");
  expect(query.get("offset")).toBe("500");
  expect(query.get("limit")).toBe("20");
  expect(new Headers(init?.headers).get("prefer")).toBe("count=exact");
});

it("mantiene el filtro REP y el orden permitido ante valores de URL desconocidos", async () => {
  fetchMock.mockResolvedValueOnce(new Response("[]", { headers: {
    "content-type": "application/json", "content-range": "*/0",
  } }));
  const result = await fetchPagosRepPendientes("org-a", {
    ...params, search: "", filters: { estado: "Timbrado" }, sortKey: "desconocida",
  });
  expect(result).toEqual({ rows: [], count: 0 });
  const [input] = fetchMock.mock.calls.at(-1)!;
  const query = new URL(String(input)).searchParams;
  expect(query.getAll("estado_rep")).toEqual(["in.(Pendiente,Error)"]);
  expect(query.get("order")).toBe("fecha_pago.asc,id.asc");
});
