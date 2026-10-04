// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { readdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { readHandle, supabaseRest } from "../../e2e/fixtures/api";
import { MUTATOR_SPECS, MUTATOR_FLOW_IDS, READ_ONLY_FLOW_IDS, mutatorPattern } from "../../e2e/fixtures/specGroups";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function pageWith(storage: Record<string, string>) {
  return { evaluate: vi.fn(async (fn: (arg: string) => unknown, arg: string) =>
    runInNewContext(`(${fn.toString()})(arg)`, {
      arg, window: { localStorage: { getItem: (key: string) => storage[key] ?? null } },
    })) } as unknown as Page;
}

describe("E2E REST — evaluación real como script de navegador, sin Vite", () => {
  function configure() {
    vi.stubEnv("VITE_SUPABASE_URL", "https://fixture.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  }
  it("lee sólo el token del destino, incluso con otra sesión presente", async () => {
    configure();
    const page = pageWith({
      "sb-other-auth-token": JSON.stringify({ access_token: "wrong-project" }),
      "sb-fixture-auth-token": JSON.stringify({ access_token: "test-token" }),
    });
    expect(await readHandle(page)).toEqual({ url: "https://fixture.supabase.co", anonKey: "public-test-key", accessToken: "test-token" });
  });
  it("distingue configuración faltante de sesión faltante", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    const page = pageWith({});
    await expect(readHandle(page)).rejects.toThrow("faltan VITE_");
    expect(page.evaluate).not.toHaveBeenCalled();
    configure();
    await expect(readHandle(page)).rejects.toThrow("no hay sesión");
  });
  it.each(["not-json", "{}"])("rechaza sesión inválida %s sin hacer REST", async (raw) => {
    configure();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(supabaseRest(pageWith({ "sb-fixture-auth-token": raw })).select("facturas", { id: "own-id" })).rejects.toThrow("no hay sesión");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserva los operadores y retorna el resultado RPC para verificar identidad", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify("own-id")));
    vi.stubGlobal("fetch", fetchMock);
    const rest = supabaseRest(pageWith({ "sb-fixture-auth-token": JSON.stringify({ access_token: "test-token" }) }));
    expect(await rest.rpc("test_rpc", { id: "own-id" })).toBe("own-id");
    fetchMock.mockResolvedValue(new Response("[]"));
    await rest.select("facturas", { id: "own-id", deleted_at: "is.null" }, "id");
    const request = new URL(fetchMock.mock.calls[1][0]);
    expect(request.searchParams.get("id")).toBe("eq.own-id");
    expect(request.searchParams.get("deleted_at")).toBe("is.null");
  });
});

it.each(["08-flujo-fiscal", "09-cierre-embarque", "10-auditoria-bulk", "11-cotizacion-a-embarque", "12-cxp-factura-pago", "25-sustituir-cfdi", "28-alta-proveedor", "30-factura-manual-timbrar"])("%s nunca se ejecuta en shards internos paralelos", (spec) => {
  expect(MUTATOR_SPECS.test(`e2e/specs/${spec}.spec.ts`)).toBe(true);
  expect(MUTATOR_SPECS.test(`e2e\\specs\\${spec}.spec.ts`)).toBe(true);
});

it("un spec nuevo requiere clasificación explícita antes de entrar al lane read-only", () => {
  const known = new Set<string>([...MUTATOR_FLOW_IDS, ...READ_ONLY_FLOW_IDS, "05", "26"]);
  const files = readdirSync("e2e/specs").filter(file => file.endsWith(".spec.ts"));
  expect(files.filter(file => !known.has(file.slice(0, 2)))).toEqual([]);
  expect(new Set(files.map(file => file.slice(0, 2))).size).toBe(files.length);
});
it("sólo los flujos mutadores solicitados pueden escribir en una corrida acotada", () => {
  const selected = mutatorPattern("11,12");
  expect(selected.test("e2e/specs/11-cotizacion-a-embarque.spec.ts")).toBe(true);
  expect(selected.test("e2e/specs/08-flujo-fiscal.spec.ts")).toBe(false);
  expect(() => mutatorPattern("99")).toThrow("IDs mutadores válidos");
  expect(() => mutatorPattern("")).toThrow("IDs mutadores válidos");
});
