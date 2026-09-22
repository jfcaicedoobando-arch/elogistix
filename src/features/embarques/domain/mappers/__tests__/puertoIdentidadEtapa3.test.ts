/**
 * Etapa 3 — el embarque hereda la identidad EXACTA del puerto de la cotización
 * y la limpia al desvincular. La dirección de la ruta sigue importando:
 * A→B y B→A son rutas distintas.
 */
import { describe, it, expect } from "vitest";
import { buildRutaUpdates, type CotizacionParaVincular } from "../embarqueCotizacion";
import { buildDesvincularCotizacionUpdates } from "../embarqueCotizacionDesvincular";
import { DEFAULT_EMBARQUE_VALUES } from "../embarqueFromDb";

const ROTTERDAM = "11111111-1111-1111-1111-111111111111";
const VERACRUZ = "22222222-2222-2222-2222-222222222222";

function cot(over: Partial<CotizacionParaVincular>): CotizacionParaVincular {
  return {
    cliente_id: "c1",
    modo: "Marítimo",
    tipo: "Importación",
    incoterm: "FOB",
    descripcion_mercancia: "Papel",
    tipo_carga: "Carga General",
    tipo_contenedor: "40HC",
    peso_kg: 1000,
    volumen_m3: 20,
    piezas: 10,
    origen: "Rotterdam, Países Bajos (NLRTM)",
    destino: "Veracruz, México (MXVER)",
    ...over,
  } as CotizacionParaVincular;
}

describe("Etapa 3 · buildRutaUpdates", () => {
  it("marítimo hereda texto e IDs exactos", () => {
    const updates = buildRutaUpdates(cot({ puerto_origen_id: ROTTERDAM, puerto_destino_id: VERACRUZ }));
    expect(updates).toEqual(expect.arrayContaining([
      ["puertoOrigen", "Rotterdam, Países Bajos (NLRTM)"],
      ["puertoDestino", "Veracruz, México (MXVER)"],
      ["puertoOrigenId", ROTTERDAM],
      ["puertoDestinoId", VERACRUZ],
    ]));
  });

  it("la ruta inversa produce IDs invertidos (A→B ≠ B→A)", () => {
    const updates = buildRutaUpdates(cot({
      origen: "Veracruz, México (MXVER)",
      destino: "Rotterdam, Países Bajos (NLRTM)",
      puerto_origen_id: VERACRUZ,
      puerto_destino_id: ROTTERDAM,
    }));
    expect(updates).toEqual(expect.arrayContaining([
      ["puertoOrigenId", VERACRUZ],
      ["puertoDestinoId", ROTTERDAM],
    ]));
  });

  it("cotización legacy sin IDs deja null y conserva el texto", () => {
    const updates = buildRutaUpdates(cot({ origen: "Shanghai", destino: "Manzanillo" }));
    expect(updates).toEqual(expect.arrayContaining([
      ["puertoOrigen", "Shanghai"],
      ["puertoDestino", "Manzanillo"],
      ["puertoOrigenId", null],
      ["puertoDestinoId", null],
    ]));
  });

  it("aéreo y terrestre no usan puertos", () => {
    const aereo = buildRutaUpdates(cot({ modo: "Aéreo" }));
    expect(aereo.map(([campo]) => campo)).not.toContain("puertoOrigenId");
    const terrestre = buildRutaUpdates(cot({ modo: "Terrestre" }));
    expect(terrestre.map(([campo]) => campo)).not.toContain("puertoDestinoId");
  });
});

describe("Etapa 3 · desvincular cotización", () => {
  it("limpia ambos IDs de puerto", () => {
    const updates = buildDesvincularCotizacionUpdates("limpiar");
    expect(updates).toEqual(expect.arrayContaining([
      ["puertoOrigenId", null],
      ["puertoDestinoId", null],
    ]));
  });
});

describe("Etapa 3 · defaults del formulario de embarque", () => {
  it("arranca sin puerto seleccionado", () => {
    expect(DEFAULT_EMBARQUE_VALUES.puertoOrigenId).toBeNull();
    expect(DEFAULT_EMBARQUE_VALUES.puertoDestinoId).toBeNull();
  });
});
