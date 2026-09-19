/**
 * El helper debe silenciar y restaurar. Si no restaura, contaminaría las
 * pruebas siguientes.
 */
import { describe, it, expect } from "vitest";
import { silenciarLogEsperado } from "../silenciarLogEsperado";

describe("silenciarLogEsperado", () => {
  it("captura sin imprimir y restaura la consola original", () => {
    const original = console.warn;
    const log = silenciarLogEsperado(["warn"]);
    console.warn("[scope]", "mensaje esperado");
    expect(log.llamadas("warn")).toEqual([["[scope]", "mensaje esperado"]]);
    log.restaurar();
    expect(console.warn).toBe(original);
  });

  it("restaurar dos veces no lanza y no devuelve llamadas", () => {
    const log = silenciarLogEsperado(["error"]);
    log.restaurar();
    expect(() => log.restaurar()).not.toThrow();
    expect(log.llamadas("error")).toEqual([]);
  });
});
