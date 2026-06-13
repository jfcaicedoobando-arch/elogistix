import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLeadEditForm } from "../useLeadEditForm";

const lead = () => ({
  empresa: "ACME S.A.", contacto: "Juan", email: "juan@acme.com", telefono: "555-1234",
  ciudad: "CDMX", pais: "México", fuente: "Web" as const, estado: "Nuevo" as const,
  score: 4, interes_modo: "MAR", notas: "Interesado",
});

describe("useLeadEditForm", () => {
  it("inicializa form con valores del lead", () => {
    const inicial = lead();
    const { result } = renderHook(() => useLeadEditForm(inicial));
    expect(result.current.form.empresa).toBe("ACME S.A.");
    expect(result.current.form.score).toBe(4);
    expect(result.current.dirty).toBe(false);
  });

  it("set() actualiza campo y dirty refleja cambio", () => {
    const inicial = lead();
    const { result } = renderHook(() => useLeadEditForm(inicial));
    act(() => { result.current.set("empresa", "BETA S.A."); });
    expect(result.current.form.empresa).toBe("BETA S.A.");
    expect(result.current.dirty).toBe(true);
  });

  it("lead undefined → form vacío y dirty=false", () => {
    const { result } = renderHook(() => useLeadEditForm(undefined));
    expect(result.current.form.empresa).toBe("");
    expect(result.current.dirty).toBe(false);
  });
});
