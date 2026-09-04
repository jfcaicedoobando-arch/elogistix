import { describe, it, expect } from "vitest";
import { copiaContadorProspectos } from "../prospectosContadorCopy";

describe("copiaContadorProspectos", () => {
  it("usa singular con 1 registro", () => {
    expect(copiaContadorProspectos(1, false)).toBe("1 prospecto en el embudo");
    expect(copiaContadorProspectos(1, true)).toBe("1 prospecto coincide con los filtros");
  });

  it("usa plural con 0 y con varios", () => {
    expect(copiaContadorProspectos(0, false)).toBe("0 prospectos en el embudo");
    expect(copiaContadorProspectos(0, true)).toBe("0 prospectos coinciden con los filtros");
    expect(copiaContadorProspectos(7, false)).toBe("7 prospectos en el embudo");
    expect(copiaContadorProspectos(7, true)).toBe("7 prospectos coinciden con los filtros");
  });
});
