import { describe, it, expect } from "vitest";
import { isLeadDirty } from "../leadEditDirty";
import { EMPTY_LEAD_EDIT_FORM, type LeadEditForm } from "@/types/crm/leadEditForm";

const baseLead = {
  empresa: "ACME",
  contacto: "Juan",
  email: "j@a.com",
  telefono: "555",
  ciudad: "CDMX",
  pais: "MX",
  fuente: "Web" as LeadEditForm["fuente"],
  estado: "Nuevo" as LeadEditForm["estado"],
  score: 3,
  interes_modo: "Marítimo",
  notas: "n",
};
const baseForm: LeadEditForm = {
  empresa: "ACME", contacto: "Juan", email: "j@a.com", telefono: "555",
  ciudad: "CDMX", pais: "MX", fuente: "Web", estado: "Nuevo", score: 3,
  interes_modo: "Marítimo", notas: "n",
};

describe("isLeadDirty", () => {
  it("retorna false cuando lead y form coinciden", () => {
    expect(isLeadDirty(baseLead, baseForm)).toBe(false);
  });

  it("detecta cambio en empresa", () => {
    expect(isLeadDirty(baseLead, { ...baseForm, empresa: "OTRA" })).toBe(true);
  });

  it("trata null en lead como string vacío", () => {
    expect(isLeadDirty({ ...baseLead, contacto: null }, { ...baseForm, contacto: "" })).toBe(false);
    expect(isLeadDirty({ ...baseLead, contacto: null }, { ...baseForm, contacto: "X" })).toBe(true);
  });

  it("aplica default score=3 cuando lead.score es null", () => {
    expect(isLeadDirty({ ...baseLead, score: null }, { ...baseForm, score: 3 })).toBe(false);
    expect(isLeadDirty({ ...baseLead, score: null }, { ...baseForm, score: 5 })).toBe(true);
  });

  it("detecta cambios en fuente/estado/notas", () => {
    expect(isLeadDirty(baseLead, { ...baseForm, fuente: "Otro" })).toBe(true);
    expect(isLeadDirty(baseLead, { ...baseForm, estado: "Calificado" as LeadEditForm["estado"] })).toBe(true);
    expect(isLeadDirty(baseLead, { ...baseForm, notas: "x" })).toBe(true);
  });

  it("EMPTY_LEAD_EDIT_FORM contra lead vacío no es dirty", () => {
    const empty = {
      empresa: "", contacto: null, email: null, telefono: null, ciudad: null,
      pais: null, fuente: "Otro" as LeadEditForm["fuente"], estado: "Nuevo" as LeadEditForm["estado"],
      score: null, interes_modo: null, notas: null,
    };
    expect(isLeadDirty(empty, EMPTY_LEAD_EDIT_FORM)).toBe(false);
  });
});
