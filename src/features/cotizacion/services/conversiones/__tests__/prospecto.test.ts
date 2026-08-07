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
  mock.tableCalls.length = 0;
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
  it("inserta cliente con campos vacíos para los opcionales y actualiza la cotización", async () => {
    mock.setTableResult("clientes", {
      data: { id: "cli-1", nombre: "Acme SA" },
      error: null,
    });
    mock.setTableResult("cotizaciones", { data: null, error: null });
    mock.setTableResult("bitacora_actividad", { data: null, error: null });

    const cli = await convertirProspectoACliente(baseInput);

    expect(cli.id).toBe("cli-1");
    const insertedCliente = mock.getMutationPayload("clientes", "insert") as Record<string, string>;
    expect(insertedCliente.nombre).toBe("Acme SA");
    expect(insertedCliente.rfc).toBe("");
    expect(insertedCliente.direccion).toBe("");

    const updated = mock.getMutationPayload("cotizaciones", "update") as Record<string, unknown>;
    expect(updated).toMatchObject({
      cliente_id: "cli-1",
      cliente_nombre: "Acme SA",
      es_prospecto: false,
    });
  });

  it("registra entrada en bitácora cuando se provee user", async () => {
    mock.setTableResult("clientes", {
      data: { id: "cli-2", nombre: "Beta" },
      error: null,
    });
    await convertirProspectoACliente({ ...baseInput, clienteData: { ...baseInput.clienteData, nombre: "Beta" } });
    expect(registrarActividadMock).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: "cotizaciones", accion: "convertir_prospecto_a_cliente" }),
    );
  });

  it("omite bitácora cuando user es null", async () => {
    mock.setTableResult("clientes", {
      data: { id: "cli-3", nombre: "Gamma" },
      error: null,
    });
    await convertirProspectoACliente({ ...baseInput, user: null });
    expect(registrarActividadMock).not.toHaveBeenCalled();
  });

  it("propaga error cuando la inserción de cliente falla", async () => {
    mock.setTableResult("clientes", { data: null, error: new Error("dup-rfc") });
    await expect(convertirProspectoACliente(baseInput)).rejects.toThrow("dup-rfc");
  });
});
