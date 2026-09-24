import { describe, expect, it } from "vitest";
import { estadoCargaConAlertas } from "../estadoCargaAlertas";

const base = { listaLoading: false, listaError: false, alertasLoading: false, alertasError: false };

describe("P2-8 estadoCargaConAlertas", () => {
  it("éxito vacío real con filtro activo: sin error ni carga", () => {
    expect(estadoCargaConAlertas({ ...base, alertaFilterActivo: true })).toEqual({ isLoading: false, isError: false });
  });
  it("error de red de alertas con filtro activo: error de vista (nunca 0 embarques)", () => {
    expect(estadoCargaConAlertas({ ...base, alertaFilterActivo: true, alertasError: true }).isError).toBe(true);
  });
  it("error de alertas sin filtro: la lista sigue visible", () => {
    expect(estadoCargaConAlertas({ ...base, alertaFilterActivo: false, alertasError: true }).isError).toBe(false);
  });
  it("alertas cargando con filtro activo: esqueleto, no conjunto vacío", () => {
    expect(estadoCargaConAlertas({ ...base, alertaFilterActivo: true, alertasLoading: true }).isLoading).toBe(true);
  });
});
