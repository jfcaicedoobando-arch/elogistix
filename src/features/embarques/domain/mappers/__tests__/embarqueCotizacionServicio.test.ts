/**
 * R215-COT-02 — el asistente de embarque debe heredar el servicio marítimo
 * (FCL/LCL) desde `tipo_embarque` de la cotización.
 */
import { describe, it, expect } from "vitest";
import {
  buildVincularCotizacionUpdates,
  type CotizacionParaVincular,
} from "../embarqueCotizacion";

const base: CotizacionParaVincular = {
  cliente_id: "cli-1",
  modo: "Marítimo",
  tipo: "Importación",
  incoterm: "FOB",
  descripcion_mercancia: "Muebles",
  tipo_carga: "Carga General",
  tipo_contenedor: "40HC",
  peso_kg: 1000,
  volumen_m3: 20,
  piezas: 100,
  origen: "CNSHA",
  destino: "MXZLO",
  num_contenedores: 1,
};

const campo = (cot: CotizacionParaVincular, name: string) =>
  buildVincularCotizacionUpdates(cot).find(([f]) => f === name)?.[1];

describe("herencia de servicio y naviera al vincular cotización", () => {
  it("FCL con naviera_id sin naviera_nombre siembra tipoServicio FCL y el id", () => {
    const cot = { ...base, tipo_embarque: "FCL", naviera_id: "nav-1", naviera_nombre: null };
    expect(campo(cot, "tipoServicio")).toBe("FCL");
    expect(campo(cot, "navieraId")).toBe("nav-1");
    expect(campo(cot, "naviera")).toBe("");
  });

  it("LCL siembra tipoServicio LCL", () => {
    const cot = { ...base, tipo_embarque: "LCL", num_contenedores: 0 };
    expect(campo(cot, "tipoServicio")).toBe("LCL");
  });

  it("no siembra tipoServicio en modos no marítimos", () => {
    const cot = { ...base, modo: "Aéreo", tipo_embarque: "FCL" };
    expect(campo(cot, "tipoServicio")).toBeUndefined();
  });
});
