import { describe, it, expect } from "vitest";
import {
  buildVincularCotizacionUpdates,
  buildDesvincularCotizacionUpdates,
  snapshotFromVincularUpdates,
  type CotizacionParaVincular,
} from "@/lib/mappers/embarqueCotizacion";

function asMap(pairs: Array<[string, unknown]>): Record<string, unknown> {
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
    const map = asMap(updates);
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
    const map = asMap(updates);
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
    const map = asMap(updates);
    expect(map.pesoKg).toBe("");
    expect(map.volumenM3).toBe("");
    expect(map.piezas).toBe("");
  });

  it("buildDesvincularCotizacionUpdates limpia todos los campos con incoterm default FOB", () => {
    const updates = buildDesvincularCotizacionUpdates();
    const map = asMap(updates);
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
    for (const f of vincular) expect(desvincular.has(f)).toBe(true);
  });

  it("modos alternos (aéreo / terrestre) mapean al campo de ruta correcto", () => {
    const aereo = asMap(buildVincularCotizacionUpdates({ ...base, modo: "Aéreo" }));
    expect(aereo.aeropuertoOrigen).toBe("Shanghai");
    expect(aereo.aeropuertoDestino).toBe("Manzanillo");

    const terrestre = asMap(buildVincularCotizacionUpdates({ ...base, modo: "Terrestre" }));
    expect(terrestre.ciudadOrigen).toBe("Shanghai");
    expect(terrestre.ciudadDestino).toBe("Manzanillo");
  });

  it("buildDesvincularCotizacionUpdates con modo 'conservar' devuelve lista vacía", () => {
    expect(buildDesvincularCotizacionUpdates("conservar")).toEqual([]);
    expect(buildDesvincularCotizacionUpdates("solo-conceptos")).toEqual([]);
  });

  // ─── Pack B v13.30.0 ─────────────────────────────────────────────────────
  it("FCL marítimo con num_contenedores siembra N placeholders con tipo precargado", () => {
    const updates = buildVincularCotizacionUpdates({
      ...base,
      tipo_embarque: "FCL",
      num_contenedores: 3,
    });
    const map = asMap(updates);
    const contenedores = map.contenedores as Array<{ tipo_contenedor: string; orden: number }>;
    expect(contenedores).toHaveLength(3);
    expect(contenedores.every((c) => c.tipo_contenedor === "40HC")).toBe(true);
    expect(contenedores.map((c) => c.orden)).toEqual([1, 2, 3]);
  });

  it("LCL marítimo siembra 1 contenedor con peso/volumen/piezas de la cotización", () => {
    const lcl = asMap(buildVincularCotizacionUpdates({
      ...base, tipo_embarque: "LCL", num_contenedores: 1,
      peso_kg: 0, volumen_m3: 4.09274, piezas: 3,
    }));
    const contenedores = lcl.contenedores as Array<{ tipo_contenedor: string; peso_kg: number; volumen_m3: number; piezas: number; orden: number }>;
    expect(contenedores).toHaveLength(1);
    expect(contenedores[0].tipo_contenedor).toBe("LCL");
    expect(contenedores[0].peso_kg).toBe(0);
    expect(contenedores[0].volumen_m3).toBe(4.09274);
    expect(contenedores[0].piezas).toBe(3);
    expect(contenedores[0].orden).toBe(1);
  });

  it("LCL aéreo o terrestre no genera contenedores", () => {
    const aereo = asMap(buildVincularCotizacionUpdates({
      ...base, modo: "Aéreo", tipo_embarque: "LCL", num_contenedores: 1,
    }));
    expect(aereo.contenedores).toBeUndefined();

    const terrestre = asMap(buildVincularCotizacionUpdates({
      ...base, modo: "Terrestre", tipo_embarque: "FCL", num_contenedores: 2,
    }));
    expect(terrestre.contenedores).toBeUndefined();
  });


  it("desvincular con snapshot respeta los campos que el usuario editó (Opción A)", () => {
    const updates = buildVincularCotizacionUpdates(base);
    const snap = snapshotFromVincularUpdates(updates);
    // Usuario edita descripción y peso, deja el resto intacto.
    const current = {
      ...Object.fromEntries(updates),
      descripcionMercancia: "Refacciones premium",
      pesoKg: "1500",
    } as Partial<import("@/lib/mappers/embarque").EmbarqueFormValues>;

    const cleanup = buildDesvincularCotizacionUpdates("limpiar", snap, current);
    const fields = new Set(cleanup.map(([k]) => k));
    // Los editados NO deben aparecer en el cleanup.
    expect(fields.has("descripcionMercancia")).toBe(false);
    expect(fields.has("pesoKg")).toBe(false);
    // Los no tocados sí deben limpiarse.
    expect(fields.has("clienteId")).toBe(true);
    expect(fields.has("puertoOrigen")).toBe(true);
  });

  it("desvincular sin snapshot mantiene comportamiento legacy (limpia todo)", () => {
    const full = buildDesvincularCotizacionUpdates("limpiar");
    expect(full.length).toBeGreaterThan(10);
  });

  // ─── Pack B+ v13.33.0 — herencia ampliada ──────────────────────────────
  it("vincular hereda tarifa, garantía, días libres, almacenaje, seguro y notas", () => {
    const updates = buildVincularCotizacionUpdates({
      ...base,
      tarifa_id: "tar-123",
      carta_garantia: true,
      dias_libres_destino: 14,
      dias_almacenaje: 7,
      seguro: true,
      valor_seguro_usd: 12500.5,
      notas: "Cliente solicita inspección previa",
    });
    const map = asMap(updates);
    expect(map.tarifaId).toBe("tar-123");
    expect(map.cartaGarantia).toBe(true);
    expect(map.diasLibresDestino).toBe("14");
    expect(map.diasAlmacenaje).toBe("7");
    expect(map.seguro).toBe(true);
    expect(map.valorSeguroUsd).toBe("12500.5");
    expect(map.notas).toBe("Cliente solicita inspección previa");
  });

  it("vincular con campos heredados null/undefined aplica defaults seguros", () => {
    const updates = buildVincularCotizacionUpdates(base);
    const map = asMap(updates);
    expect(map.tarifaId).toBe("");
    expect(map.cartaGarantia).toBe(false);
    expect(map.diasLibresDestino).toBe("0");
    expect(map.diasAlmacenaje).toBe("0");
    expect(map.seguro).toBe(false);
    expect(map.valorSeguroUsd).toBe("");
    expect(map.notas).toBe("");
  });

  it("desvincular limpia los nuevos campos heredados de Pack B+", () => {
    const updates = buildDesvincularCotizacionUpdates();
    const map = asMap(updates);
    expect(map.tarifaId).toBe("");
    expect(map.cartaGarantia).toBe(false);
    expect(map.diasLibresDestino).toBe("0");
    expect(map.diasAlmacenaje).toBe("0");
    expect(map.seguro).toBe(false);
    expect(map.valorSeguroUsd).toBe("");
    expect(map.notas).toBe("");
  });
});
