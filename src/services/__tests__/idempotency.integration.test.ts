/**
 * Tests de integración Ola A.3 — idempotencia de mutaciones críticas.
 *
 * Simulan dos escenarios reales que históricamente producían duplicados:
 *  1. Doble-click: el usuario dispara el submit dos veces antes de que la
 *     primera respuesta vuelva. Ambas llamadas viajan con el MISMO
 *     `p_request_id` (gracias a `useStableRequestId`), por lo que la
 *     segunda debe recibir la respuesta cacheada en vez de insertar otro.
 *  2. Reintento tras error de red: la primera llamada rechaza, el usuario
 *     reintenta sin resetear el id, y la RPC retorna la misma respuesta
 *     que cualquier intento exitoso posterior produciría.
 *
 * El mock de `supabase.rpc` emula `idempotency_claim/store` server-side
 * con un Map keyed por `p_request_id`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock supabase.rpc ANTES de importar los servicios.
const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { crearEmbarqueRpc } from "@/services/embarque/mutations";
import { consolidarProformas } from "@/services/proforma/consolidar";
import { useStableRequestId } from "@/lib/idempotency";

/** Estado server-side simulado: requestId → respuesta cacheada. */
type Cache = Map<string, unknown>;

/**
 * Instala un handler que emula `idempotency_claim/store`:
 *  - Si el `p_request_id` ya está en cache, devuelve la respuesta cacheada
 *    (incrementando un contador de hits para verificar duplicados bloqueados).
 *  - Si no, llama a `factory()` para crear una nueva respuesta y la guarda.
 *  - Permite forzar rechazo en intentos específicos via `failOn` (0-indexed).
 */
function installRpcHandler(opts: {
  factory: () => unknown;
  failOn?: number[]; // índices de intentos que deben rechazar
}) {
  const cache: Cache = new Map();
  const hits = { created: 0, cached: 0 };
  let attempt = -1;

  rpcMock.mockImplementation(async (_fn: string, params: Record<string, unknown>) => {
    attempt++;
    if (opts.failOn?.includes(attempt)) {
      return { data: null, error: { message: "network failure", code: "PGRST000" } };
    }
    const key = String(params.p_request_id ?? "");
    if (key && cache.has(key)) {
      hits.cached++;
      return { data: cache.get(key), error: null };
    }
    const resp = opts.factory();
    if (key) cache.set(key, resp);
    hits.created++;
    return { data: resp, error: null };
  });

  return { cache, hits, getAttempts: () => attempt + 1 };
}

const baseEmbarque = {
  embarque: { tipo: "Maritimo", modo: "FCL", cliente_id: "c1", expediente: "EXP-1" } as never,
  conceptosVenta: [],
  conceptosCosto: [],
  documentos: [],
};

const baseProformas = {
  organizationId: "org-1",
  proformaIds: ["p1", "p2"],
  embarqueId: "e1",
  clienteId: "c1",
  clienteNombre: "Cliente",
  expediente: "EXP-1",
  blMaster: null,
  operador: null,
  diasCredito: 0,
  tasaIva: 0.16,
};

beforeEach(() => {
  rpcMock.mockReset();
});

describe("Idempotencia A.3 — doble-click", () => {
  it("crearEmbarqueRpc: dos clicks concurrentes con el mismo requestId crean UN solo embarque", async () => {
    const handler = installRpcHandler({ factory: () => ({ id: "emb-nuevo" }) });
    const { result } = renderHook(() => useStableRequestId());
    const reqId = result.current.get();

    // Doble-click: ambas llamadas se disparan antes de que la primera resuelva.
    const [r1, r2] = await Promise.all([
      crearEmbarqueRpc({ ...baseEmbarque, requestId: reqId }),
      crearEmbarqueRpc({ ...baseEmbarque, requestId: reqId }),
    ]);

    expect(r1.id).toBe("emb-nuevo");
    expect(r2.id).toBe("emb-nuevo"); // misma respuesta
    expect(handler.hits.created).toBe(1);
    expect(handler.hits.cached).toBe(1); // segundo intento bloqueado
    expect(handler.cache.size).toBe(1);
  });

  it("consolidarProformas: dos clicks producen UNA sola proforma consolidada", async () => {
    const handler = installRpcHandler({ factory: () => ({ id: "prof-new", folio: "PRO-1" }) });
    const { result } = renderHook(() => useStableRequestId());
    const reqId = result.current.get();

    const [a, b] = await Promise.all([
      consolidarProformas({ ...baseProformas, requestId: reqId }),
      consolidarProformas({ ...baseProformas, requestId: reqId }),
    ]);

    expect(a.id).toBe("prof-new");
    expect(b.id).toBe("prof-new");
    expect(handler.hits.created).toBe(1);
    expect(handler.hits.cached).toBe(1);
  });

  it("requestIds DISTINTOS sí producen dos embarques (control negativo)", async () => {
    const ids = ["emb-A", "emb-B"];
    const handler = installRpcHandler({ factory: () => ({ id: ids.shift() }) });

    const r1 = await crearEmbarqueRpc({ ...baseEmbarque, requestId: "id-uno" });
    const r2 = await crearEmbarqueRpc({ ...baseEmbarque, requestId: "id-dos" });

    expect(r1.id).toBe("emb-A");
    expect(r2.id).toBe("emb-B");
    expect(handler.hits.created).toBe(2);
    expect(handler.hits.cached).toBe(0);
  });
});

describe("Idempotencia A.3 — reintento tras error de red", () => {
  it("crearEmbarqueRpc: primer intento falla, reintento con mismo id no duplica", async () => {
    const handler = installRpcHandler({
      factory: () => ({ id: "emb-retry" }),
      failOn: [0], // primer intento rechaza
    });
    const { result } = renderHook(() => useStableRequestId());
    const reqId = result.current.get();

    // Intento 1: error
    await expect(crearEmbarqueRpc({ ...baseEmbarque, requestId: reqId })).rejects.toMatchObject({
      message: "network failure",
    });

    // El usuario reintenta SIN resetear el id (useStableRequestId mantiene el mismo).
    const reqIdReintento = result.current.get();
    expect(reqIdReintento).toBe(reqId);

    const ok = await crearEmbarqueRpc({ ...baseEmbarque, requestId: reqIdReintento });
    expect(ok.id).toBe("emb-retry");

    // Tras éxito, la UI resetea el id; el próximo submit usaría uno nuevo.
    act(() => result.current.reset());
    expect(result.current.get()).not.toBe(reqId);

    // Hubo 2 attempts pero sólo 1 creación efectiva.
    expect(handler.hits.created).toBe(1);
    expect(handler.getAttempts()).toBe(2);
  });

  it("consolidarProformas: 3 intentos (2 fallos + 1 éxito) crean UNA sola proforma", async () => {
    const handler = installRpcHandler({
      factory: () => ({ id: "prof-retry" }),
      failOn: [0, 1],
    });
    const { result } = renderHook(() => useStableRequestId());
    const reqId = result.current.get();

    await expect(consolidarProformas({ ...baseProformas, requestId: reqId })).rejects.toBeTruthy();
    await expect(consolidarProformas({ ...baseProformas, requestId: reqId })).rejects.toBeTruthy();
    const ok = await consolidarProformas({ ...baseProformas, requestId: reqId });

    expect(ok.id).toBe("prof-retry");
    expect(handler.hits.created).toBe(1);
    expect(handler.getAttempts()).toBe(3);
  });
});
