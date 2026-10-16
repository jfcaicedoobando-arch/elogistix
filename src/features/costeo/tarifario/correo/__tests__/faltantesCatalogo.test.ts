import { describe, it, expect } from "vitest";
import { faltantesDeCatalogo } from "../faltantesCatalogo";
import { filaCorreo } from "../comun";

const cat = { puertos: [{ id: "1", name: "Shanghai", code: "CNSHA" }, { id: "2", name: "Manzanillo", code: "MXZLO" }],
  navieras: [{ id: "n", name: "Maersk", code: "MAEU" }] };
const fila = (origen: string, naviera: string) => filaCorreo({ origen, destino: "Manzanillo", agente: "X", naviera, t20: 1, t40: 2, desde: "2026-10-01", hasta: "2026-10-31", dias: 7 });

describe("faltantesDeCatalogo", () => {
  it("separa puertos y navieras sin alta y deja pendientes sólo esas filas", () => {
    const r = faltantesDeCatalogo([fila("Shanghai", "MAEU"), fila("Lianyungang", "HMM"), fila("Lianyungang", "MAEU")], cat);
    expect(r.puertos).toEqual(["Lianyungang"]);
    expect(r.navieras).toEqual(["HMM"]);
    expect(r.pendientes).toHaveLength(2);
  });
  it("sin faltantes no hay pendientes", () => {
    expect(faltantesDeCatalogo([fila("CNSHA", "Maersk")], cat).pendientes).toHaveLength(0);
  });
});
