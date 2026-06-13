/**
 * Tests del builder de payload de INSERT en `crm_oportunidades`.
 * Garantiza que los defaults se apliquen, que `vendedor_id` respete la
 * intención explícita del caller, y que `created_by` se complete desde
 * el usuario autenticado.
 */
import { describe, it, expect } from "vitest";
import { buildOportunidadInsertPayload } from "../oportunidadPayload";

const USER = { id: "u1", email: "ops@lc.mx" };

describe("buildOportunidadInsertPayload", () => {
  it("aplica defaults cuando faltan campos opcionales", () => {
    const out = buildOportunidadInsertPayload(
      { nombre: "Op A", etapa_id: "et1" },
      USER,
    );
    expect(out).toMatchObject({
      nombre: "Op A",
      etapa_id: "et1",
      cliente_nombre: "",
      monto_estimado: 0,
      moneda: "MXN",
      probabilidad: 0,
      modo: "",
      origen: "",
      destino: "",
      notas: "",
      vendedor_email: "ops@lc.mx",
      vendedor_id: "u1",
      created_by: "u1",
    });
  });

  it("permite overrides explícitos sobre los defaults", () => {
    const out = buildOportunidadInsertPayload(
      {
        nombre: "Op B",
        etapa_id: "et2",
        monto_estimado: 5000,
        moneda: "USD",
        probabilidad: 75,
        origen: "CNSHA",
      },
      USER,
    );
    expect(out.monto_estimado).toBe(5000);
    expect(out.moneda).toBe("USD");
    expect(out.probabilidad).toBe(75);
    expect(out.origen).toBe("CNSHA");
  });

  it("respeta vendedor_id explícito incluso si es null", () => {
    const out = buildOportunidadInsertPayload(
      { nombre: "Sin vendedor", etapa_id: "et1", vendedor_id: null },
      USER,
    );
    expect(out.vendedor_id).toBeNull();
    // created_by sigue siendo el user autenticado
    expect(out.created_by).toBe("u1");
  });

  it("usa el id del usuario cuando vendedor_id es undefined", () => {
    const out = buildOportunidadInsertPayload(
      { nombre: "Hereda vendedor", etapa_id: "et1" },
      USER,
    );
    expect(out.vendedor_id).toBe("u1");
  });

  it("acepta usuario null (sin sesión) y mantiene defaults vacíos", () => {
    const out = buildOportunidadInsertPayload(
      { nombre: "Op C", etapa_id: "et1" },
      null,
    );
    expect(out.vendedor_id).toBeNull();
    expect(out.created_by).toBeNull();
    expect(out.vendedor_email).toBe("");
  });

  it("ignora campos con valor undefined sin pisar defaults", () => {
    const out = buildOportunidadInsertPayload(
      { nombre: "Op D", etapa_id: "et1", origen: undefined, notas: undefined },
      USER,
    );
    // Defaults intactos
    expect(out.origen).toBe("");
    expect(out.notas).toBe("");
  });
});
