import { describe, expect, it } from "vitest";
import { buildOportunidadFormPayload } from "@/features/crm/domain/oportunidadFormPayload";
import { EMPTY_OPORTUNIDAD } from "@/features/crm/domain/oportunidadFormState";

const base = {
  ...EMPTY_OPORTUNIDAD,
  nombre: "Oportunidad ACME",
  etapa_id: "etapa-1",
  origen_tipo: "prospecto" as const,
  lead_id: "lead-1",
  cliente_id: "cliente-1",
  cliente_nombre: "ACME SA de CV",
};

describe("buildOportunidadFormPayload · origen", () => {
  it("en edición conserva el cliente vinculado de un lead convertido", () => {
    const p = buildOportunidadFormPayload(base, false, true);
    expect(p.lead_id).toBe("lead-1");
    expect(p.cliente_id).toBe("cliente-1");
    expect(p.cliente_nombre).toBe("ACME SA de CV");
  });

  it("al crear con origen prospecto no arrastra cliente", () => {
    const p = buildOportunidadFormPayload(base, false, false);
    expect(p.lead_id).toBe("lead-1");
    expect(p.cliente_id).toBeNull();
    expect(p.cliente_nombre).toBe("");
  });

  it("al crear con origen cliente no arrastra prospecto", () => {
    const p = buildOportunidadFormPayload({ ...base, origen_tipo: "cliente" }, false, false);
    expect(p.lead_id).toBeNull();
    expect(p.cliente_id).toBe("cliente-1");
  });
});
