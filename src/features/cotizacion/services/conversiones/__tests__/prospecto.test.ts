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
    rfc: "ACM010101AA1",
    cp: "06600",
    regimen_fiscal: "601",
    uso_cfdi_default: "G03",
    forma_pago_default: "99",
    metodo_pago_default: "PPD",
  },
};

describe("convertirProspectoACliente", () => {
  it("P0: una sola RPC atómica devuelve el cliente resultante", async () => {
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", {
      data: { cliente_id: "cli-1", nombre: "Acme SA", creado: true, sin_cambios: false },
      error: null,
    });

    const cli = await convertirProspectoACliente(baseInput);

    expect(cli).toEqual({ id: "cli-1", nombre: "Acme SA", creado: true, sinCambios: false });
    expect(mock.rpcCalls).toHaveLength(1);
    expect(mock.rpcCalls[0].fn).toBe("convertir_prospecto_a_cliente_rpc");
    expect(mock.rpcCalls[0].args).toMatchObject({
      p_cotizacion_id: "cot-1",
      p_cliente: baseInput.clienteData,
    });
  });

  it("es idempotente: en el reintento `creado` es false y `sinCambios` true", async () => {
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", {
      data: { cliente_id: "cli-9", nombre: "Acme SA", creado: false, sin_cambios: true },
      error: null,
    });
    const cli = await convertirProspectoACliente(baseInput);
    expect(cli.creado).toBe(false);
    expect(cli.sinCambios).toBe(true);
    expect(cli.id).toBe("cli-9");
  });

  it("P0: NO registra bitácora desde el cliente (la escribe la RPC)", async () => {
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", {
      data: { cliente_id: "cli-2", nombre: "Beta", creado: true },
      error: null,
    });
    await convertirProspectoACliente(baseInput);
    expect(registrarActividadMock).not.toHaveBeenCalled();
    expect(mock.rpcCalls).toHaveLength(1);
  });

  it("propaga error cuando convertir_prospecto_a_cliente_rpc falla", async () => {
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", { data: null, error: new Error("dup-rfc") });
    await expect(convertirProspectoACliente(baseInput)).rejects.toThrow("dup-rfc");
  });

  it("falla si la RPC no devuelve cliente_id", async () => {
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", { data: {}, error: null });
    await expect(convertirProspectoACliente(baseInput)).rejects.toThrow(/No se pudo convertir/);
  });
});
