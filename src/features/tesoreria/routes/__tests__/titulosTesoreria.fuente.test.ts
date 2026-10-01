import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
describe("N04 · cobertura de títulos de dinero", () => {
  it.each([
    ["TesoreriaFlujo", "Flujo de caja proyectado"],
    ["TesoreriaEstadoCuenta", "Estado de cuenta"],
    ["TesoreriaCuentas", "Cuentas bancarias"],
    ["TesoreriaPagosProgramados", "Pagos programados"],
  ])("%s anuncia su propio título, también en carga/error/vacío", (route, titulo) => {
    const src = readFileSync(new URL(`../${route}.tsx`, import.meta.url), "utf8");
    expect(src).toContain(`useDocumentTitle("${titulo}")`);
    expect(src.indexOf(`useDocumentTitle("${titulo}")`)).toBeLessThan(src.indexOf("return ("));
  });
});
