import { describe, it, expect } from "vitest";
import { leerTodasLasPaginas } from "../paginado";
import { ResultadoTruncadoError } from "../assertNotTruncated";

describe("leerTodasLasPaginas", () => {
  it("concatena páginas hasta recibir un lote incompleto", async () => {
    const total = Array.from({ length: 7 }, (_, i) => ({ i }));
    const rangos: Array<[number, number]> = [];
    const res = await leerTodasLasPaginas<{ i: number }>(
      "test",
      (desde, hasta) => {
        rangos.push([desde, hasta]);
        return Promise.resolve({ data: total.slice(desde, hasta + 1), error: null });
      },
      { lote: 3 },
    );
    expect(res).toHaveLength(7);
    expect(rangos).toEqual([[0, 2], [3, 5], [6, 8]]);
  });

  it("propaga el error de la consulta", async () => {
    await expect(
      leerTodasLasPaginas("test", () => Promise.resolve({ data: null, error: { message: "boom" } })),
    ).rejects.toMatchObject({ message: "boom" });
  });

  it("falla visible al alcanzar el tope duro en vez de devolver un parcial", async () => {
    await expect(
      leerTodasLasPaginas<{ i: number }>(
        "test",
        (desde) => Promise.resolve({ data: Array.from({ length: 2 }, (_, k) => ({ i: desde + k })), error: null }),
        { lote: 2, capDuro: 4 },
      ),
    ).rejects.toBeInstanceOf(ResultadoTruncadoError);
  });
});
