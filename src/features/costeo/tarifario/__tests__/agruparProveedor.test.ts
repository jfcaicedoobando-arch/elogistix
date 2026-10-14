import { describe, expect, it } from "vitest";
import { agruparPorProveedor } from "../agruparProveedor";
import type { TarifaImport } from "../importarTarifas";

const tarifa = (agenteId: string): TarifaImport =>
  ({ fila: 1, origenId: "o", destinoId: "d", input: { agente_id: agenteId } as TarifaImport["input"] });

describe("agruparPorProveedor", () => {
  it("agrupa por proveedor y conserva el orden de primera aparición", () => {
    const tarifas = [tarifa("a1"), tarifa("b1"), tarifa("a1")];
    const grupos = agruparPorProveedor(tarifas, new Map([["a1", "Longsail"], ["b1", "Rainbow"]]), new Map());
    expect(grupos).toEqual([
      { proveedor: "Longsail", indices: [0, 2] },
      { proveedor: "Rainbow", indices: [1] },
    ]);
  });

  it("usa el nombre del agente cuando no es un proveedor del correo", () => {
    const grupos = agruparPorProveedor([tarifa("x9")], new Map(), new Map([["x9", "Agente Local"]]));
    expect(grupos).toEqual([{ proveedor: "Agente Local", indices: [0] }]);
  });

  it("agrupa bajo «Otro agente» cuando no hay ni proveedor ni agente", () => {
    const grupos = agruparPorProveedor([tarifa("zz")], new Map(), new Map());
    expect(grupos).toEqual([{ proveedor: "Otro agente", indices: [0] }]);
  });
});
