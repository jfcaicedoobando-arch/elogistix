import { describe, it, expect, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

const { registrarActividadMock } = vi.hoisted(() => ({ registrarActividadMock: vi.fn(async () => undefined) }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: registrarActividadMock }));

import { convertirProspectoACliente } from "@/features/cotizacion/services/conversiones/prospecto";

beforeEach(() => {
  mock.resetResults();
  mock.rpcCalls.length = 0;
  registrarActividadMock.mockClear();
});

const baseInput = {
  cotizacionId: "cot-1",
  clienteData: {
    nombre: "Acme SA",
    contacto: "Juan Pérez",
    email: "juan@acme.mx",
    telefono: "5555555555",
  },
  user: { id: "u-1", email: "ops@librecarga.com" },
};

describe("convertirProspectoACliente", () => {
  it("Ola 6 · M3: usa la RPC atómica y devuelve el cliente resultante", async () => {
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", {
      data: { cliente_id: "cli-1", nombre: "Acme SA", creado: true },
      error: null,
    });

    const cli = await convertirProspectoACliente(baseInput);

    expect(cli).toEqual({ id: "cli-1", nombre: "Acme SA", creado: true });
    expect(mock.rpcCalls).toHaveLength(1);
    expect(mock.rpcCalls[0].fn).toBe("convertir_prospecto_a_cliente_rpc");
    expect(mock.rpcCalls[0].args).toMatchObject({
      p_cotizacion_id: "cot-1",
      p_cliente: baseInput.clienteData,
    });
  });

  it("es idempotente: si la conversión ya existía, `creado` es false", async () => {
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", {
      data: { cliente_id: "cli-9", nombre: "Acme SA", creado: false },
      error: null,
    });
    const cli = await convertirProspectoACliente(baseInput);
    expect(cli.creado).toBe(false);
    expect(cli.id).toBe("cli-9");
  });

  it("registra entrada en bitácora cuando se provee user", async () => {
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", {
      data: { cliente_id: "cli-2", nombre: "Beta", creado: true },
      error: null,
    });
    await convertirProspectoACliente({
      ...baseInput,
      clienteData: { ...baseInput.clienteData, nombre: "Beta" },
    });
    expect(registrarActividadMock).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: "cotizaciones", accion: "convertir_prospecto_a_cliente" }),
    );
  });

  it("omite bitácora cuando user es null", async () => {
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", {
      data: { cliente_id: "cli-3", nombre: "Gamma", creado: true },
      error: null,
    });
    await convertirProspectoACliente({ ...baseInput, user: null });
    expect(registrarActividadMock).not.toHaveBeenCalled();
  });

  it("propaga error cuando la RPC falla", async () => {
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", { data: null, error: new Error("dup-rfc") });
    await expect(convertirProspectoACliente(baseInput)).rejects.toThrow("dup-rfc");
  });

  it("falla si la RPC no devuelve cliente_id", async () => {
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", { data: {}, error: null });
    await expect(convertirProspectoACliente(baseInput)).rejects.toThrow(/No se pudo convertir/);
  });
});
