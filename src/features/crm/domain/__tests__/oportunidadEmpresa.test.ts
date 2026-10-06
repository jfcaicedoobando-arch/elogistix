import { describe, expect, it } from "vitest";
import { EMPTY_OPORTUNIDAD } from "../oportunidadFormState";
import { buildOportunidadFormPayload, validarOportunidadForm } from "../oportunidadFormPayload";
import { buildOportunidadInsertPayload } from "../oportunidadPayload";

const form = { ...EMPTY_OPORTUNIDAD, origen_tipo: "cliente" as const, nombre: "Acme", cliente_id: "cliente-1", etapa_id: "etapa-1" };

describe("Empresa obligatoria al crear oportunidad", () => {
  it("rechaza alta sin empresa", () => {
    expect(validarOportunidadForm(form, false)?.title).toBe("Selecciona la empresa asociada");
  });
  it("acepta alta con empresa y conserva las validaciones de origen", () => {
    expect(validarOportunidadForm({ ...form, empresa_id: "empresa-1" }, false)).toBeNull();
    expect(validarOportunidadForm({ ...form, empresa_id: "empresa-1", cliente_id: null }, false)?.title)
      .toBe("Selecciona el cliente de origen");
  });
  it("no impone el nuevo requisito a la edición histórica", () => {
    expect(validarOportunidadForm(form, false, true)).toBeNull();
    expect(buildOportunidadFormPayload(form, false, true)).not.toHaveProperty("empresa_id");
  });
  it("separa la empresa del payload de columnas de oportunidad", () => {
    const input = buildOportunidadFormPayload({ ...form, empresa_id: "empresa-1" }, false);
    expect(input.empresa_id).toBe("empresa-1");
    expect(buildOportunidadInsertPayload(input, null)).not.toHaveProperty("empresa_id");
  });
});