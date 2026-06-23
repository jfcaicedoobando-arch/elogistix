import { describe, it, expect } from "vitest";
import { derivarEstadoContenedor } from "../estadoContenedorCell";
import type { EmbarqueRow } from "@/features/embarques/hooks";

const baseMaritimo = {
  modo: "Marítimo" as const,
  bl_master: "BL-123",
  contenedor: "MSCU1234567",
} satisfies Pick<EmbarqueRow, "modo" | "bl_master" | "contenedor">;

describe("derivarEstadoContenedor", () => {
  it("modo Marítimo sin BL Master → blFalta=true y pendientes=true", () => {
    const r = derivarEstadoContenedor({ ...baseMaritimo, bl_master: "" });
    expect(r.blFalta).toBe(true);
    expect(r.pendientes).toBe(true);
    expect(r.pendientesTitle).toContain("BL Master");
  });

  it("modo Marítimo con BL en blanco (whitespace) → blFalta=true", () => {
    const r = derivarEstadoContenedor({ ...baseMaritimo, bl_master: "   " });
    expect(r.blFalta).toBe(true);
  });

  it("modo Aéreo sin BL → blFalta=false (no aplica)", () => {
    const r = derivarEstadoContenedor({ modo: "Aéreo", bl_master: "", contenedor: "" });
    expect(r.blFalta).toBe(false);
  });

  it("info.incompletos > 0 → pendientes=true con título", () => {
    const r = derivarEstadoContenedor(baseMaritimo, { count: 3, primero: "ABC", incompletos: 2 });
    expect(r.pendientes).toBe(true);
    expect(r.pendientesTitle).toContain("2 contenedor");
  });

  it("legacyCount como fallback cuando no hay info", () => {
    const r = derivarEstadoContenedor(baseMaritimo, undefined, 5);
    expect(r.count).toBe(5);
  });

  it("sin info ni legacyCount → count=1 y primero desde embarque", () => {
    const r = derivarEstadoContenedor(baseMaritimo);
    expect(r.count).toBe(1);
    expect(r.primero).toBe("MSCU1234567");
  });

  it("happy path → todo OK, sin pendientes", () => {
    const r = derivarEstadoContenedor(baseMaritimo, { count: 2, primero: "MSCU1", incompletos: 0 });
    expect(r.pendientes).toBe(false);
    expect(r.pendientesTitle).toBe("");
  });

  it("LCL con contenedores incompletos → pendientes=false (contenedor opcional)", () => {
    const r = derivarEstadoContenedor(
      { ...baseMaritimo, tipo_carga: "LCL" },
      { count: 1, primero: "", incompletos: 1 },
    );
    expect(r.esLcl).toBe(true);
    expect(r.incompletos).toBe(0);
    expect(r.pendientes).toBe(false);
  });

  it("LCL sin BL Master → pendientes=true sólo por BL", () => {
    const r = derivarEstadoContenedor(
      { ...baseMaritimo, bl_master: "", tipo_carga: "LCL" },
      { count: 1, primero: "", incompletos: 2 },
    );
    expect(r.blFalta).toBe(true);
    expect(r.incompletos).toBe(0);
    expect(r.pendientes).toBe(true);
    expect(r.pendientesTitle).toBe("BL Master sin capturar");
  });
});

