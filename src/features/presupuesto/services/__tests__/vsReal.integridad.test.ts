import { beforeEach, expect, it, vi } from "vitest";
import { agregarGastosCxP, aplicarLiquidacionesComisiones, construirFilaHuerfanos, restarNotasCreditoCxP } from "../vsRealDomain";

const state = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]>, calls: [] as unknown[][] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  let rows = state.rows[table] ?? [];
  const field = (row: Record<string, unknown>, key: string): unknown => key.split(".").reduce<unknown>((obj, k) => (obj as Record<string, unknown> | null)?.[k], row);
  const query = {
    select: (value: string) => { state.calls.push([table, "select", value]); if (value.includes("!inner")) rows = rows.filter(r => r.proveedor_facturas != null); return query; },
    eq: (key: string, value: unknown) => { rows = rows.filter(r => field(r, key) === value); return query; },
    neq: (key: string, value: unknown) => { state.calls.push([table, "neq", key, value]); rows = rows.filter(r => field(r, key) != null && field(r, key) !== value); return query; },
    is: (key: string, value: unknown) => { state.calls.push([table, "is", key, value]); rows = rows.filter(r => field(r, key) === value); return query; },
    gte: (key: string, value: string) => { rows = rows.filter(r => String(field(r, key)) >= value); return query; },
    lte: (key: string, value: string) => { rows = rows.filter(r => String(field(r, key)) <= value); return query; },
    limit: (n: number) => { rows = rows.slice(0, n); return query; },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
  }; return query;
} } }));
vi.mock("../categorias", () => ({ fetchCategorias: vi.fn().mockResolvedValue([{ id: "cat", nombre: "Fletes" }]) }));
vi.mock("../mensual", () => ({ fetchPresupuestoMensualAnio: vi.fn().mockResolvedValue([]) }));
import { fetchPresupuestoVsReal } from "../vsReal";
const invoice = { categoria_presupuesto_id: "cat", subtotal: 100, moneda: "MXN", tipo_cambio_usd: 1, fecha_emision: "2026-10-02", estado: "Pendiente", estado_aprobacion: "pendiente", deleted_at: null, organization_id: "org" };
const note = { monto: 116, subtotal: 100, moneda: "MXN", fecha: "2026-10-02", estado: "Aplicada", deleted_at: null, organization_id: "org", proveedor_facturas: invoice };
beforeEach(() => { state.rows = {}; state.calls = []; });
it("incluye subtotal sin categoría y conserva NC negativa huérfana", () => {
  const { porCategoria } = agregarGastosCxP([{ ...invoice, categoria_presupuesto_id: null }]);
  expect(construirFilaHuerfanos(porCategoria, new Set())?.real_mxn).toBe(100);
  restarNotasCreditoCxP([{ ...note, categoria_presupuesto_id: null, tipo_cambio_usd: 1 }], porCategoria);
  restarNotasCreditoCxP([{ ...note, categoria_presupuesto_id: "inactiva", tipo_cambio_usd: 1 }], porCategoria);
  expect(construirFilaHuerfanos(porCategoria, new Set())?.real_mxn).toBe(-100);
});
it("cuenta falta de TC también sin categoría", () => {
  expect(agregarGastosCxP([{ ...invoice, categoria_presupuesto_id: null, moneda: "USD", tipo_cambio_usd: null }]).sinTc).toBe(1);
  expect(restarNotasCreditoCxP([{ ...note, categoria_presupuesto_id: null, moneda: "USD", tipo_cambio_usd: null }], new Map())).toBe(1);
});
it("liquidaciones sin Comisiones activa no desaparecen ni duplican gastos", () => {
  const real = new Map([["inactiva", 50]]);
  aplicarLiquidacionesComisiones(real, [], [{ total_mxn: 75, periodo: "2026-10" }]);
  expect(construirFilaHuerfanos(real, new Set())?.real_mxn).toBe(125);
  const conCat = new Map([["com", 50]]);
  aplicarLiquidacionesComisiones(conCat, [{ id: "com", nombre: "Comisiones" }], [{ total_mxn: 75, periodo: "2026-10" }]);
  expect(conCat.get("com")).toBe(125);
  expect(construirFilaHuerfanos(conCat, new Set(["com"]))).toBeNull();
});
it("excluye rechazadas, canceladas, borradas y otra organización; conserva pendientes", async () => {
  state.rows.proveedor_facturas = [invoice, { ...invoice, estado_aprobacion: "aprobada" }, { ...invoice, estado_aprobacion: "rechazada" }, { ...invoice, estado: "Cancelada" }, { ...invoice, deleted_at: "2026-10-03" }, { ...invoice, organization_id: "otra" }];
  expect((await fetchPresupuestoVsReal("2026-10", "org")).total_real_mxn).toBe(200);
  expect(state.calls).toContainEqual(["proveedor_facturas", "neq", "estado_aprobacion", "rechazada"]);
});
it("NC excluye padre borrado o ausente, conserva mes propio y contrato EERR de padre no borrado", async () => {
  state.rows.proveedor_notas_credito = [note, { ...note, proveedor_facturas: { ...invoice, fecha_emision: "2026-09-01", estado_aprobacion: "rechazada" } }, { ...note, proveedor_facturas: { ...invoice, estado: "Cancelada" } }, { ...note, proveedor_facturas: { ...invoice, deleted_at: "2026-10-01" } }, { ...note, proveedor_facturas: null }];
  expect((await fetchPresupuestoVsReal("2026-10", "org")).total_real_mxn).toBe(-300);
});
it("avisa NC sin base incluso sin categoría y suma liquidaciones con huérfanos", async () => {
  state.rows.proveedor_facturas = [{ ...invoice, categoria_presupuesto_id: null }];
  state.rows.proveedor_notas_credito = [{ ...note, subtotal: null, proveedor_facturas: { ...invoice, categoria_presupuesto_id: null } }];
  state.rows.liquidaciones_comision = [{ total_mxn: 25, periodo: "2026-10", estado: "Pendiente", deleted_at: null, organization_id: "org" }];
  expect(await fetchPresupuestoVsReal("2026-10", "org")).toMatchObject({ total_real_mxn: 125, notas_proveedor_sin_base_count: 1 });
});

it("conserva una NC aislada de categoría inactiva y omite saldo huérfano cero", () => {
  const real = new Map<string, number>();
  restarNotasCreditoCxP([{ ...note, categoria_presupuesto_id: "inactiva", tipo_cambio_usd: 1 }], real);
  expect(construirFilaHuerfanos(real, new Set())?.real_mxn).toBe(-100);
  expect(construirFilaHuerfanos(new Map([["inactiva", 0]]), new Set())).toBeNull();
});
