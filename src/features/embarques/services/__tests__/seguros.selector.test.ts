import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), abort: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock("../bitacoraEmbarques", () => ({ registrarBitacoraEmbarque: vi.fn() }));
vi.mock("../../domain/seguroFacturaSelector", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../domain/seguroFacturaSelector")>(),
  SEGURO_FACTURA_SELECTOR_ENABLED: true,
}));
import { fetchFacturasSeguroElegibles, type FacturasSeguroPage, type FacturasSeguroRequest } from "../seguros";
import { SEGURO_FACTURA_SELECTOR_ERROR } from "../../domain/seguroFacturaSelector";

const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const input: FacturasSeguroRequest = { embarqueId: uuid(1), prima: "100.005", moneda: "MXN", seguroId: uuid(2) };
const item = (i: number) => ({ id: uuid(i), folio_interno: `FP-${i}`, proveedor_nombre: "Insurance", subtotal: "9007199254740993.001", moneda: "MXN" });
function reply(data: unknown, error: unknown = null) {
  const promise = Promise.resolve({ data, error });
  mocks.abort.mockReturnValue(promise);
  return Object.assign(promise, { abortSignal: mocks.abort });
}
beforeEach(() => { vi.clearAllMocks(); });

describe("selector148 RPC boundary", () => {
  it("sends the exact parameter contract and normalized decimal premium, preserving subtotal text", async () => {
    const cursor = { fecha_emision: "2026-10-01", id: uuid(3) };
    const page = { items: [item(4)], next_cursor: null };
    mocks.rpc.mockReturnValue(reply(page));
    const signal = new AbortController().signal;
    expect(await fetchFacturasSeguroElegibles({ ...input, cursor, limit: 1 }, signal)).toEqual(page);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("seguro_facturas_elegibles", {
      p_embarque_id: uuid(1), p_prima: "100.01", p_moneda: "MXN", p_seguro_id: uuid(2),
      p_limit: 1, p_cursor_fecha: "2026-10-01", p_cursor_id: uuid(3),
    });
    expect(mocks.abort).toHaveBeenCalledExactlyOnceWith(signal);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("uses explicit null initial cursor/current policy and default limit25", async () => {
    mocks.rpc.mockReturnValue(reply({ items: [], next_cursor: null }));
    await expect(fetchFacturasSeguroElegibles({ ...input, seguroId: null })).resolves.toEqual({ items: [], next_cursor: null });
    expect(mocks.rpc).toHaveBeenCalledWith("seguro_facturas_elegibles", expect.objectContaining({
      p_seguro_id: null, p_limit: 25, p_cursor_fecha: null, p_cursor_id: null,
    }));
  });

  it("reads 275 eligible invoices across all pages without a100-row client cutoff", async () => {
    const all = Array.from({ length: 275 }, (_, i) => item(i + 10));
    mocks.rpc.mockImplementation((_name, args: { p_cursor_id: string | null; p_limit: number }) => {
      const start = args.p_cursor_id === null ? 0 : all.findIndex((row) => row.id === args.p_cursor_id) + 1;
      const items = all.slice(start, start + args.p_limit);
      return reply({ items, next_cursor: start + items.length < all.length ? { fecha_emision: "2026-10-01", id: items.at(-1)!.id } : null });
    });
    const seen: string[] = [];
    let cursor: FacturasSeguroPage["next_cursor"] = null;
    do {
      const page = await fetchFacturasSeguroElegibles({ ...input, cursor });
      seen.push(...page.items.map((row) => row.id));
      cursor = page.next_cursor;
    } while (cursor);
    expect(seen).toEqual(all.map((row) => row.id));
    expect(new Set(seen).size).toBe(275);
    expect(mocks.rpc).toHaveBeenCalledTimes(11);
  });

  it.each(["PGRST202", "42501", "57014"])("masks unavailable/denied/timeout error %s and never falls back", async (code) => {
    mocks.rpc.mockReturnValue(reply(null, { code, message: "private SQL context", details: "hidden rows" }));
    await expect(fetchFacturasSeguroElegibles(input)).rejects.toThrow(SEGURO_FACTURA_SELECTOR_ERROR);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { items: [], next_cursor: { fecha_emision: "2026-01-01", id: uuid(4) } },
    { items: [item(4)], next_cursor: { fecha_emision: "2026-01-01", id: uuid(5) } },
    { items: [{ ...item(4), subtotal: 100 }], next_cursor: null },
    { items: [{ ...item(4), hidden_assignment: 100 }], next_cursor: null },
    { items: [item(4), item(4)], next_cursor: null },
    { items: [], next_cursor: null, discarded_count: 200 },
  ])("rejects an invalid or expanded response without claiming completeness (%j)", async (data) => {
    mocks.rpc.mockReturnValue(reply(data));
    await expect(fetchFacturasSeguroElegibles(input)).rejects.toThrow(SEGURO_FACTURA_SELECTOR_ERROR);
  });

  it("rejects a repeating cursor and an oversized page", async () => {
    const cursor = { fecha_emision: "2026-01-01", id: uuid(4) };
    mocks.rpc.mockReturnValue(reply({ items: [item(4)], next_cursor: cursor }));
    await expect(fetchFacturasSeguroElegibles({ ...input, cursor })).rejects.toThrow(SEGURO_FACTURA_SELECTOR_ERROR);
    mocks.rpc.mockReturnValue(reply({ items: [item(4), item(5)], next_cursor: null }));
    await expect(fetchFacturasSeguroElegibles({ ...input, limit: 1 })).rejects.toThrow(SEGURO_FACTURA_SELECTOR_ERROR);
  });

  it.each([0, -1, 101, 1.5])( "rejects an invalid limit %s without querying", async (limit) => {
    await expect(fetchFacturasSeguroElegibles({ ...input, limit })).rejects.toThrow(SEGURO_FACTURA_SELECTOR_ERROR);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not deliver a response after cancellation", async () => {
    const controller = new AbortController();
    mocks.rpc.mockReturnValue(reply({ items: [item(4)], next_cursor: null }));
    controller.abort();
    await expect(fetchFacturasSeguroElegibles(input, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
