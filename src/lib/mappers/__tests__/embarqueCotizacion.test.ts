import { describe, it, expect } from "vitest";
import {
  buildVincularCotizacionUpdates,
  buildDesvincularCotizacionUpdates,
  type CotizacionParaVincular,
} from "../embarqueCotizacion";

const baseCot: CotizacionParaVincular = {
  cliente_id: "cli-1",
  modo: "Marítimo",
  tipo: "Importación",
  incoterm: "FOB",
  descripcion_mercancia: "Pallets",
  tipo_carga: "FCL",
  tipo_contenedor: "20'",
  peso_kg: 1500,
  volumen_m3: 25,
  piezas: 10,
  origen: "MXZLO",
  destino: "MXMEX",
};

describe("buildVincularCotizacionUpdates", () => {
  it("mapea todos los campos de la cotización a pares [key, value]", () => {
    const updates = buildVincularCotizacionUpdates(baseCot);
    const map = Object.fromEntries(updates);
    expect(map.clienteId).toBe("cli-1");
    expect(map.modo).toBe("Marítimo");
    expect(map.incoterm).toBe("FOB");
    expect(map.pesoKg).toBe("1500");
    expect(map.volumenM3).toBe("25");
    expect(map.piezas).toBe("10");
    expect(map.puertoOrigen).toBe("MXZLO");
    expect(map.puertoDestino).toBe("MXMEX");
  });

  it("aplica defaults para nulls/vacíos", () => {
    const map = Object.fromEntries(
      buildVincularCotizacionUpdates({
        ...baseCot,
        cliente_id: null,
        tipo_carga: "",
        tipo_contenedor: null,
        peso_kg: 0,
        volumen_m3: 0,
        piezas: 0,
        origen: "",
        destino: "",
      }),
    );
    expect(map.clienteId).toBe("");
    expect(map.tipoCarga).toBe("Carga General");
    expect(map.tipoContenedor).toBe("");
    expect(map.pesoKg).toBe("");
    expect(map.volumenM3).toBe("");
    expect(map.piezas).toBe("");
  });
});

describe("buildDesvincularCotizacionUpdates", () => {
  it("limpia campos y resetea incoterm a FOB y tipoCarga a 'Carga General'", () => {
    const map = Object.fromEntries(buildDesvincularCotizacionUpdates());
    expect(map.clienteId).toBe("");
    expect(map.descripcionMercancia).toBe("");
    expect(map.incoterm).toBe("FOB");
    expect(map.tipoCarga).toBe("Carga General");
    expect(map.puertoOrigen).toBe("");
    expect(map.puertoDestino).toBe("");
  });
});
