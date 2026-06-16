import { describe, it, expect } from "vitest";
import {
  buildVincularCotizacionUpdates,
  buildDesvincularCotizacionUpdates,
  type CotizacionParaVincular,
} from "@/lib/mappers/embarqueCotizacion";

function asMap(pairs: Array<[string, string]>): Record<string, string> {
  return Object.fromEntries(pairs);
}

describe("embarqueCotizacion mapper", () => {
  const base: CotizacionParaVincular = {
    cliente_id: "cli-1",
    modo: "Maritimo",
    tipo: "Importacion",
    incoterm: "CIF",
    descripcion_mercancia: "Auto partes",
    tipo_carga: "FCL",
    tipo_contenedor: "40HC",
    peso_kg: 1200,
    volumen_m3: 18.5,
    piezas: 30,
    origen: "Shanghai",
    destino: "Manzanillo",
  };

  it("buildVincularCotizacionUpdates mapea todos los campos en orden", () => {
    const updates = buildVincularCotizacionUpdates(base);
    const map = asMap(updates as Array<[string, string]>);
    expect(map.clienteId).toBe("cli-1");
    expect(map.modo).toBe("Maritimo");
    expect(map.tipo).toBe("Importacion");
    expect(map.incoterm).toBe("CIF");
    expect(map.descripcionMercancia).toBe("Auto partes");
    expect(map.tipoCarga).toBe("FCL");
    expect(map.tipoContenedor).toBe("40HC");
    expect(map.pesoKg).toBe("1200");
    expect(map.volumenM3).toBe("18.5");
    expect(map.piezas).toBe("30");
    expect(map.puertoOrigen).toBe("Shanghai");
    expect(map.puertoDestino).toBe("Manzanillo");
  });

  it("convierte cliente_id null a string vacío y aplica default 'Carga General'", () => {
    const updates = buildVincularCotizacionUpdates({
      ...base,
      cliente_id: null,
      tipo_carga: "",
      tipo_contenedor: null,
    });
    const map = asMap(updates as Array<[string, string]>);
    expect(map.clienteId).toBe("");
    expect(map.tipoCarga).toBe("Carga General");
    expect(map.tipoContenedor).toBe("");
  });

  it("convierte 0 numérico a cadena vacía (peso/volumen/piezas)", () => {
    const updates = buildVincularCotizacionUpdates({
      ...base,
      peso_kg: 0,
      volumen_m3: 0,
      piezas: 0,
    });
    const map = asMap(updates as Array<[string, string]>);
    expect(map.pesoKg).toBe("");
    expect(map.volumenM3).toBe("");
    expect(map.piezas).toBe("");
  });

  it("buildDesvincularCotizacionUpdates limpia todos los campos con incoterm default FOB", () => {
    const updates = buildDesvincularCotizacionUpdates();
    const map = asMap(updates as Array<[string, string]>);
    expect(map.clienteId).toBe("");
    expect(map.incoterm).toBe("FOB");
    expect(map.tipoCarga).toBe("Carga General");
    expect(map.descripcionMercancia).toBe("");
    expect(map.puertoOrigen).toBe("");
    expect(map.puertoDestino).toBe("");
  });

  it("desvincular limpia un superset que incluye los campos de vincular (marítimo)", () => {
    const vincular = new Set(buildVincularCotizacionUpdates(base).map(([k]) => k));
    const desvincular = new Set(buildDesvincularCotizacionUpdates().map(([k]) => k));
    // Todos los campos vinculados (modo marítimo) deben quedar contemplados
    // en el set que limpia desvincular, aunque desvincular abarque más
    // (rutas aéreas/terrestres + MSDS) para garantizar limpieza total.
    for (const f of vincular) expect(desvincular.has(f)).toBe(true);
  });

  it("modos alternos (aéreo / terrestre) mapean al campo de ruta correcto", () => {
    const aereo = Object.fromEntries(
      buildVincularCotizacionUpdates({ ...base, modo: "Aéreo" }) as Array<[string, string]>,
    );
    expect(aereo.aeropuertoOrigen).toBe("Shanghai");
    expect(aereo.aeropuertoDestino).toBe("Manzanillo");

    const terrestre = Object.fromEntries(
      buildVincularCotizacionUpdates({ ...base, modo: "Terrestre" }) as Array<[string, string]>,
    );
    expect(terrestre.ciudadOrigen).toBe("Shanghai");
    expect(terrestre.ciudadDestino).toBe("Manzanillo");
  });

  it("buildDesvincularCotizacionUpdates con modo 'conservar' devuelve lista vacía", () => {
    expect(buildDesvincularCotizacionUpdates("conservar")).toEqual([]);
    expect(buildDesvincularCotizacionUpdates("solo-conceptos")).toEqual([]);
  });
});
