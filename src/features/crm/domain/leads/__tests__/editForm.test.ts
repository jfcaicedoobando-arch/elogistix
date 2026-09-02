import { describe, it, expect } from "vitest";
import { toLeadEditForm, patchLeadEdit, type LeadEditSource } from "../editForm";

const lead: LeadEditSource = {
  empresa: "QA-CODEX Comercial Demo",
  contacto: null,
  email: "qa-codex-comercial@example.com",
  telefono: null,
  ciudad: null,
  pais: null,
  fuente: "Otro",
  estado: "Nuevo",
  score: null,
  interes_modo: null,
  notas: null,
};

describe("toLeadEditForm", () => {
  it("usa el correo persistido como valor del formulario (misma fuente que el mailto)", () => {
    expect(toLeadEditForm(lead).email).toBe("qa-codex-comercial@example.com");
  });

  it("un correo realmente nulo queda vacío", () => {
    expect(toLeadEditForm({ ...lead, email: null }).email).toBe("");
  });

  it("sin lead devuelve el formulario vacío", () => {
    expect(toLeadEditForm(undefined).empresa).toBe("");
  });
});

describe("patchLeadEdit", () => {
  const base = toLeadEditForm(lead);

  it("editar sólo Notas no envía el correo (no lo puede borrar)", () => {
    const patch = patchLeadEdit(base, { notas: "Llamada del lunes" });
    expect(patch).toEqual({ notas: "Llamada del lunes" });
    expect("email" in patch).toBe(false);
  });

  it("editar el correo sí lo incluye", () => {
    const patch = patchLeadEdit(base, { email: "nuevo@example.com" });
    expect(patch).toEqual({ email: "nuevo@example.com" });
  });

  it("un campo tocado que quedó igual no viaja al servidor", () => {
    expect(patchLeadEdit(base, { email: base.email })).toEqual({});
  });
});
