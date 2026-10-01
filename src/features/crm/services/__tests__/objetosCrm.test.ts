import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: (fila: unknown) => {
        insert(fila);
        return { select: () => ({ single: async () => ({ data: { id: "1", nombre: "X" }, error: null }) }) };
      },
    })),
  },
}));

import { crearContacto, crearEmpresa } from "../objetosCrm";

describe("objetosCrm — validaciones de alta", () => {
  beforeEach(() => insert.mockClear());

  it("rechaza empresa sin nombre sin tocar la base", async () => {
    await expect(crearEmpresa("   ")).rejects.toThrow("obligatorio");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rechaza contacto con correo inválido", async () => {
    await expect(crearContacto({ nombre: "Ana", email: "ana@" })).rejects.toThrow("correo");
    expect(insert).not.toHaveBeenCalled();
  });

  it("normaliza correo y vacíos a null", async () => {
    await crearContacto({ nombre: " Ana ", email: " ANA@X.MX ", telefono: " " });
    expect(insert).toHaveBeenCalledWith({ nombre: "Ana", email: "ana@x.mx", telefono: null });
  });
});
