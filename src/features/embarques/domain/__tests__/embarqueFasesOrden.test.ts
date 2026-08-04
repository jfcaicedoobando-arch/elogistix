import { describe, it, expect } from "vitest";
import { hayFechasFueraDeOrden } from "../embarqueFases";
import type { FaseEmbarque } from "../embarqueFasesTipos";

function fase(id: FaseEmbarque["id"], fecha: string | null): FaseEmbarque {
  return { id, label: id, iconoId: "confirmado", fecha, estado: "completada" };
}

describe("hayFechasFueraDeOrden", () => {
  it("devuelve false cuando las fechas están en orden ascendente", () => {
    const fases = [
      fase("confirmado", "2026-01-01"),
      fase("en_transito", "2026-01-05"),
      fase("arribo", "2026-01-10"),
    ];
    expect(hayFechasFueraDeOrden(fases)).toBe(false);
  });

  it("ignora fases sin fecha", () => {
    const fases = [
      fase("confirmado", "2026-01-01"),
      fase("en_transito", null),
      fase("arribo", "2026-01-10"),
    ];
    expect(hayFechasFueraDeOrden(fases)).toBe(false);
  });

  it("devuelve true cuando una fecha posterior en el orden es anterior en el tiempo", () => {
    const fases = [
      fase("confirmado", "2026-01-10"),
      fase("en_transito", "2026-01-05"),
      fase("arribo", "2026-01-20"),
    ];
    expect(hayFechasFueraDeOrden(fases)).toBe(true);
  });

  it("devuelve false con lista vacía o una sola fecha", () => {
    expect(hayFechasFueraDeOrden([])).toBe(false);
    expect(hayFechasFueraDeOrden([fase("confirmado", "2026-01-01")])).toBe(false);
  });
});
