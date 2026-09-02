import { describe, it, expect } from "vitest";
import { buscarPaginas } from "@/features/search/domain/paginas";

describe("buscarPaginas", () => {
  it("regresa vacío si no hay query", () => {
    expect(buscarPaginas("", "admin")).toEqual([]);
    expect(buscarPaginas("   ", "admin")).toEqual([]);
  });

  it("encuentra Tarifas de agentes para un rol con acceso a Costeo, ignorando acentos", () => {
    const resultados = buscarPaginas("tarifas", "gerente_operaciones");
    expect(resultados.some((r) => r.url === "/costeo/tarifas")).toBe(true);
  });

  it("no regresa páginas de Costeo para roles sin acceso (operador/viewer/cliente)", () => {
    expect(buscarPaginas("agentes", "viewer").some((r) => r.url.startsWith("/costeo"))).toBe(false);
    expect(buscarPaginas("navieras", "cliente").some((r) => r.url.startsWith("/costeo"))).toBe(false);
  });

  it("operador sí conserva su acceso existente a Costeo", () => {
    expect(buscarPaginas("agentes", "operador").some((r) => r.url === "/costeo/agentes")).toBe(true);
  });

  it("filtra por término sin coincidencia", () => {
    expect(buscarPaginas("xyz-no-existe", "admin")).toEqual([]);
  });

  it("todos los resultados son de tipo pagina", () => {
    const resultados = buscarPaginas("navieras", "admin");
    expect(resultados.every((r) => r.type === "pagina")).toBe(true);
  });
});
