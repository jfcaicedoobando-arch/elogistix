import { describe, it, expect, vi } from "vitest";
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_FILAS,
  mensajeArchivoDemasiadoGrande,
  mensajeDemasiadasFilas,
  procesarEnLotes,
} from "../importLimits";

describe("importLimits (N-05)", () => {
  it("topes documentados", () => {
    expect(IMPORT_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(IMPORT_MAX_FILAS).toBe(1000);
  });

  it("mensajes en es-MX con el dato concreto", () => {
    expect(mensajeArchivoDemasiadoGrande(3 * 1024 * 1024)).toContain("3.0 MB");
    expect(mensajeDemasiadasFilas(1500)).toContain("1500");
  });

  it("procesarEnLotes ejecuta todos los elementos y reporta avance", async () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    const fn = vi.fn(async (n: number) => n);
    const avances: number[] = [];
    await procesarEnLotes(items, fn, (p) => avances.push(p));
    expect(fn).toHaveBeenCalledTimes(12);
    expect(avances.at(-1)).toBe(12);
  });

  it("propaga el error de una fila", async () => {
    await expect(
      procesarEnLotes([1, 2], async (n) => {
        if (n === 2) throw new Error("fila inválida");
      }),
    ).rejects.toThrow("fila inválida");
  });
});
