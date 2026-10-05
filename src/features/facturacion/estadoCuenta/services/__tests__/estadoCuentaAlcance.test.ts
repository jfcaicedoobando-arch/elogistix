import { describe, expect, it } from "vitest";
import { crearEstadoCuentaAlcance } from "../estadoCuentaAlcance";

describe("alcance del PDF de estado de cuenta", () => {
  it("identifica antigüedad y todos los filtros combinados del corte", () => {
    const alcance = crearEstadoCuentaAlcance({ desde: "2026-09-01", hasta: "2026-10-04", moneda: "MXN",
      soloConSaldo: true, bucket: "d_1_30", busqueda: " A3 " });
    expect(alcance.parcial).toBe(true);
    expect(alcance.filtros).toEqual([
      "Emisión: 01/09/2026 a 04/10/2026", "Moneda: MXN", "Sólo con saldo",
      "Antigüedad: 1-30 días", "Folio o expediente: A3",
    ]);
  });

  it("describe un rango abierto y no anuncia un límite de fechas inexistente", () => {
    expect(crearEstadoCuentaAlcance({ desde: "2026-09-01" }).filtros).toEqual(["Emisión: 01/09/2026 a sin fecha final"]);
    expect(crearEstadoCuentaAlcance({ hasta: "2026-10-04" }).filtros).toEqual(["Emisión: sin fecha inicial a 04/10/2026"]);
  });

  it("identifica como completa la selección histórica sin filtros", () => {
    expect(crearEstadoCuentaAlcance({ desde: null, hasta: null, moneda: "todas", busqueda: "  ", bucket: null }))
      .toEqual({ parcial: false, filtros: [] });
  });
});
