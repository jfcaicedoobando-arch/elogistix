/**
 * v13.56.1 — Tests del service de Cierre Financiero (Bloque S).
 * Cubre el contrato con las 3 RPCs: validar_cierre_embarque,
 * cerrar_embarque y reabrir_embarque, y la lectura del log.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const rpc = vi.fn();
  const order = vi.fn();
  const eq = vi.fn();
  const select = vi.fn();
  const from = vi.fn();
  return {
    supabase: { rpc, from },
    __mocks: { rpc, from, select, eq, order },
  };
});

import { supabase } from "@/integrations/supabase/client";
import {
  cerrarEmbarque,
  fetchCierreLog,
  reabrirEmbarque,
  validarCierre,
} from "@/features/embarques/services/cierre";

const mockedRpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
const mockedFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cierre service", () => {
  describe("validarCierre", () => {
    it("retorna el objeto de validación de la RPC", async () => {
      mockedRpc.mockResolvedValue({
        data: {
          puede_cerrar: true,
          checks: [{ regla: "cxc_sin_pendientes", ok: true }],
        },
        error: null,
      });
      const result = await validarCierre("emb-1");
      expect(mockedRpc).toHaveBeenCalledWith("validar_cierre_embarque", { p_embarque_id: "emb-1" });
      expect(result.puede_cerrar).toBe(true);
      expect(result.checks).toHaveLength(1);
    });

    it("lanza Error con el mensaje cuando la RPC falla", async () => {
      mockedRpc.mockResolvedValue({ data: null, error: { message: "no autorizado" } });
      await expect(validarCierre("emb-1")).rejects.toThrow("no autorizado");
    });
  });

  describe("cerrarEmbarque", () => {
    it("llama la RPC con el id del embarque", async () => {
      mockedRpc.mockResolvedValue({ data: { ok: true }, error: null });
      await cerrarEmbarque("emb-2");
      expect(mockedRpc).toHaveBeenCalledWith("cerrar_embarque", { p_embarque_id: "emb-2" });
    });

    it("propaga el error de la RPC al cerrar embarque", async () => {
      mockedRpc.mockResolvedValue({ data: null, error: { message: "validaciones no satisfechas" } });
      await expect(cerrarEmbarque("emb-2")).rejects.toThrow("validaciones no satisfechas");
    });
  });

  describe("reabrirEmbarque", () => {
    it("usa la RPC canónica con motivo y request_id, sin email del cliente (B-06)", async () => {
      mockedRpc.mockResolvedValue({ data: { ok: true }, error: null });
      const motivo = "Corrección de costos por reclamo del cliente principal";
      await reabrirEmbarque("emb-3", motivo, "ops@elogistix.mx");
      expect(mockedRpc).toHaveBeenCalledWith(
        "reabrir_embarque",
        expect.objectContaining({
          p_embarque_id: "emb-3",
          p_motivo: motivo,
          // B-06: el actor lo deriva la BD desde la sesión; el cliente ya no lo envía.
          p_usuario_email: "",
        }),
      );
      const args = mockedRpc.mock.calls.at(-1)?.[1] as { p_request_id?: string };
      expect(typeof args?.p_request_id).toBe("string");
    });

    it("propaga error de motivo corto", async () => {
      mockedRpc.mockResolvedValue({ data: null, error: { message: "Motivo de reapertura requerido (mínimo 20 caracteres)" } });
      await expect(reabrirEmbarque("emb-3", "corto", "ops@elogistix.mx")).rejects.toThrow(/Motivo/);
    });
  });

  describe("fetchCierreLog", () => {
    it("consulta la bitácora con orden descendente", async () => {
      const orderFn = vi.fn().mockResolvedValue({
        data: [{ id: "log-1", embarque_id: "emb-4", accion: "cerrar", usuario_id: "u1", motivo: null, snapshot: {}, created_at: "2026-06-17T00:00:00Z" }],
        error: null,
      });
      // L1: la consulta principal desempata con un segundo .order("id").
      const eqFn = vi.fn().mockReturnValue({ order: () => ({ order: orderFn }) });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      // Bitácora fallback chain: select -> eq -> eq -> order
      const bitacoraOrder = vi.fn().mockResolvedValue({ data: [], error: null });
      const bitacoraEq2 = vi.fn().mockReturnValue({ order: bitacoraOrder });
      const bitacoraEq1 = vi.fn().mockReturnValue({ eq: bitacoraEq2 });
      const bitacoraSelect = vi.fn().mockReturnValue({ eq: bitacoraEq1 });
      mockedFrom.mockImplementation((tabla: string) => {
        if (tabla === "bitacora_actividad") return { select: bitacoraSelect };
        return { select: selectFn };
      });

      const log = await fetchCierreLog("emb-4");
      expect(mockedFrom).toHaveBeenCalledWith("cierre_embarque_log");
      expect(eqFn).toHaveBeenCalledWith("embarque_id", "emb-4");
      expect(orderFn).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(log).toHaveLength(1);
      expect(log[0].accion).toBe("cerrar");
    });

    it("retorna array vacío cuando no hay datos", async () => {
      const orderFn = vi.fn().mockResolvedValue({ data: null, error: null });
      const bitacoraOrder = vi.fn().mockResolvedValue({ data: null, error: null });
      mockedFrom.mockImplementation((tabla: string) => {
        if (tabla === "bitacora_actividad") {
          return { select: () => ({ eq: () => ({ eq: () => ({ order: bitacoraOrder }) }) }) };
        }
        return { select: () => ({ eq: () => ({ order: () => ({ order: orderFn }) }) }) };
      });
      const log = await fetchCierreLog("emb-5");
      expect(log).toEqual([]);
    });
  });
});
