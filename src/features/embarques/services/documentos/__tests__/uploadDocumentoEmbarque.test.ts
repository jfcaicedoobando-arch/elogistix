/**
 * `uploadDocumentoEmbarque` — ciclo A→B→A del claim cacheado de idempotencia.
 * Bug: si el claim cacheado (`idempotency_claim`) trae un `path` distinto al
 * que ya tiene la fila `documentos_embarque.archivo`, la fila debe
 * resincronizarse ANTES de devolver `cached: true`, o fallar explícitamente
 * si el UPDATE afecta 0 filas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadDocumentoEmbarque } from "@/features/embarques/services/documentos/uploadDocumentoEmbarque";

const state: {
  selectResult: { data: { archivo: string | null } | null; error: null };
  rpcClaim: unknown;
  updateResult: { data: Array<{ id: string }> | null; error: null };
  updateEqCalls: string[];
} = {
  selectResult: { data: null, error: null },
  rpcClaim: { __idempotency_pending: true },
  updateResult: { data: [{ id: "doc-1" }], error: null },
  updateEqCalls: [],
};

vi.mock("@/services/storage/index", () => ({
  uploadFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/integrations/supabase/client", () => {
  // Un solo builder chainable: `mode` distingue el SELECT inicial del UPDATE
  // posterior, ya que ambos comparten `.eq()` pero terminan en promesas distintas.
  let mode: "select" | "update" = "select";
  const builder = {
    select: vi.fn(() => {
      if (mode === "update") return Promise.resolve(state.updateResult);
      return builder;
    }),
    update: vi.fn(() => {
      mode = "update";
      return builder;
    }),
    eq: vi.fn((_col: string, v: string) => {
      if (mode === "update") state.updateEqCalls.push(v);
      return builder;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(state.selectResult)),
  };
  return {
    supabase: {
      from: vi.fn(() => {
        mode = "select";
        return builder;
      }),
      rpc: vi.fn((fn: string) => {
        if (fn === "idempotency_claim") return Promise.resolve({ data: state.rpcClaim, error: null });
        return Promise.resolve({ data: null, error: null });
      }),
    },
  };
});

function makeFile(name = "a.pdf", content = "contenido"): File {
  return new File([content], name, { type: "application/pdf" });
}

beforeEach(() => {
  state.selectResult = { data: null, error: null };
  state.rpcClaim = { __idempotency_pending: true };
  state.updateResult = { data: [{ id: "doc-1" }], error: null };
  state.updateEqCalls = [];
  vi.clearAllMocks();
});

describe("uploadDocumentoEmbarque — ciclo A→B→A del claim cacheado", () => {
  it("resincroniza la fila cuando el claim cacheado difiere del archivo actual", async () => {
    state.selectResult = { data: { archivo: "embarques/e1/d1/aaa-viejo.pdf" }, error: null };
    state.rpcClaim = { path: "embarques/e1/d1/bbb-nuevo.pdf", fileName: "nuevo.pdf" };

    const result = await uploadDocumentoEmbarque("e1", "d1", makeFile());

    expect(result.cached).toBe(true);
    expect(result.path).toBe("embarques/e1/d1/bbb-nuevo.pdf");
    // El UPDATE de resincronización debe haberse ejecutado sobre docId "d1".
    expect(state.updateEqCalls).toContain("d1");
  });

  it("no toca la fila si el claim cacheado ya coincide con el archivo actual", async () => {
    state.selectResult = { data: { archivo: "embarques/e1/d1/ccc-igual.pdf" }, error: null };
    state.rpcClaim = { path: "embarques/e1/d1/ccc-igual.pdf" };

    const result = await uploadDocumentoEmbarque("e1", "d1", makeFile());

    expect(result.cached).toBe(true);
    expect(state.updateEqCalls).toHaveLength(0);
  });

  it("lanza error explícito en español si la resincronización afecta 0 filas", async () => {
    state.selectResult = { data: { archivo: "embarques/e1/d1/aaa-viejo.pdf" }, error: null };
    state.rpcClaim = { path: "embarques/e1/d1/bbb-nuevo.pdf" };
    state.updateResult = { data: [], error: null };

    await expect(uploadDocumentoEmbarque("e1", "d1", makeFile())).rejects.toThrow(
      /No se pudo sincronizar el documento/,
    );
  });
});
