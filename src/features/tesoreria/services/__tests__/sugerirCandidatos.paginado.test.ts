/**
 * MNY-P2.6 — antes se leía una sola página de 21 pagos y luego se descartaban
 * los ya conciliados: si todos esos 21 estaban vinculados, el panel decía "Sin
 * candidatos" aunque existiera uno válido más adelante. Ahora se siguen leyendo
 * páginas acotadas hasta encontrar candidatos libres, conservando `truncado`.
 */
import { describe, it, expect, vi } from "vitest";
import { acumularCandidatos, PAGINAS_MAX } from "../sugerirCandidatos.paginado";
import type { Candidato } from "../sugerirCandidatos.tipos";

function candidato(id: string): Candidato {
  // SAFE-CAST: la función acumuladora no inspecciona los campos del candidato.
  return { pago_id: id } as Candidato;
}

describe("acumularCandidatos (MNY-P2.6)", () => {
  it("sigue leyendo páginas cuando la primera viene toda vinculada", async () => {
    const paginas = [
      { data: Array.from({ length: 3 }, (_, i) => `a${i}`), error: null },
      { data: ["libre"], error: null },
    ];
    const leer = vi.fn(async (desde: number) => paginas[desde / 3]);
    const res = await acumularCandidatos(3, leer, async (filas) =>
      filas.filter((f) => f === "libre").map(candidato),
    );
    expect(leer).toHaveBeenCalledTimes(2);
    expect(res.candidatos.map((c) => c.pago_id)).toEqual(["libre"]);
    expect(res.truncado).toBe(false);
  });

  it("marca truncado cuando hay más candidatos que el tope", async () => {
    const res = await acumularCandidatos(
      2,
      async () => ({ data: ["x", "y"], error: null }),
      async (filas) => filas.map(candidato),
    );
    expect(res.truncado).toBe(true);
    expect(res.candidatos).toHaveLength(2);
  });

  it("no lee sin límite: se detiene en el tope de páginas y avisa truncado", async () => {
    const leer = vi.fn(async () => ({ data: ["ligado", "ligado"], error: null }));
    const res = await acumularCandidatos(2, leer, async () => []);
    expect(leer).toHaveBeenCalledTimes(PAGINAS_MAX);
    expect(res.candidatos).toEqual([]);
    expect(res.truncado).toBe(true);
  });

  it("propaga el error de lectura en vez de fingir 'sin coincidencias'", async () => {
    await expect(
      acumularCandidatos(
        2,
        async () => ({ data: null, error: { message: "boom" } }),
        async () => [],
      ),
    ).rejects.toMatchObject({ message: "boom" });
  });
});
