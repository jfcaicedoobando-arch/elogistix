/**
 * embarque.extra — edge cases no cubiertos en embarque.test.ts.
 */
import { describe, it, expect } from "vitest";
import {
  buildEmbarquePayload,
  buildConceptosVentaPayload,
  buildConceptosCostoPayload,
  
  DEFAULT_EMBARQUE_VALUES,
} from "@/lib/mappers/embarque";
import type { EmbarqueFormValues } from "@/lib/mappers/embarque";

function base(over: Partial<EmbarqueFormValues> = {}): EmbarqueFormValues {
  return {
    ...DEFAULT_EMBARQUE_VALUES,
    modo: "Marítimo",
    tipo: "Importación",
    clienteId: "c1",
    descripcionMercancia: "Mercancía",
    pesoKg: "500",
    volumenM3: "5",
    piezas: "10",
    incoterm: "FOB",
    ...over,
  };
}

describe("embarque.extra — buildEmbarquePayload contenedores dinámicos", () => {
  it("[EE-01] suma peso/vol/piezas desde contenedores en modo Marítimo", () => {
    const v = base({
      contenedores: [
        { numero_contenedor: "ABCD1234567", tipo_contenedor: "20GP", bl_house: "", peso_kg: 200, volumen_m3: 2, piezas: 4, orden: 1 },
        { numero_contenedor: "EFGH7654321", tipo_contenedor: "40HC", bl_house: "", peso_kg: 300, volumen_m3: 3, piezas: 6, orden: 2 },
      ],
    });
    const p = buildEmbarquePayload(v, [], "Cliente", "op");
    expect(p.peso_kg).toBe(500);
    expect(p.volumen_m3).toBe(5);
    expect(p.piezas).toBe(10);
  });

  it("[EE-02] tipo_contenedor hereda del primer contenedor cuando tipoServicio != LCL", () => {
    const v = base({
      tipoServicio: "FCL",
      contenedores: [{ numero_contenedor: "ABCD1234567", tipo_contenedor: "40HC", bl_house: "", peso_kg: 0, volumen_m3: 0, piezas: 0, orden: 1 }],
    });
    const p = buildEmbarquePayload(v, [], "Cliente", "op");
    expect(p.tipo_contenedor).toBe("40HC");
  });

  it("[EE-03] tipo_contenedor es 'LCL' cuando tipoServicio=LCL", () => {
    const v = base({
      tipoServicio: "LCL",
      contenedores: [{ numero_contenedor: "NONE", tipo_contenedor: "20GP", bl_house: "", peso_kg: 0, volumen_m3: 0, piezas: 0, orden: 1 }],
    });
    const p = buildEmbarquePayload(v, [], "Cliente", "op");
    expect(p.tipo_contenedor).toBe("LCL");
  });
});

describe("embarque.extra — buildEmbarquePayload aéreo/terrestre", () => {
  it("[EE-04] aéreo: aeropuertos y MAWB/HAWB pasan a null cuando vacíos", () => {
    const v = base({ modo: "Aéreo", tipo: "Exportación", aeropuertoOrigen: "", aeropuertoDestino: "", mawb: "" });
    const p = buildEmbarquePayload(v, [], "C", "op");
    expect(p.aeropuerto_origen).toBeNull();
    expect(p.aeropuerto_destino).toBeNull();
    expect(p.mawb).toBeNull();
  });

  it("[EE-05] terrestre: ciudad_origen y carta_porte pasan a null cuando vacíos", () => {
    const v = base({ modo: "Terrestre", tipo: "Importación", ciudadOrigen: "", ciudadDestino: "", cartaPorte: "" });
    const p = buildEmbarquePayload(v, [], "C", "op");
    expect(p.ciudad_origen).toBeNull();
    expect(p.ciudad_destino).toBeNull();
    expect(p.carta_porte).toBeNull();
  });

  it("[EE-06] etd no-vacío se preserva como string", () => {
    const v = base({ etd: "2027-03-01" });
    const p = buildEmbarquePayload(v, [], "C", "op");
    expect(p.etd).toBe("2027-03-01");
  });
});

describe("embarque.extra — buildConceptosVentaPayload", () => {
  it("[EE-07] contenedor_id se mapea cuando viene en el item", () => {
    const result = buildConceptosVentaPayload([
      { id: 1, concepto: "Handling", cantidad: 1, precioUnitario: 200, moneda: "USD", contenedorId: "cont-9" },
    ]);
    expect(result[0].contenedor_id).toBe("cont-9");
  });

  it("[EE-08] contenedor_id es null cuando no viene y moneda MXN pasa", () => {
    const result = buildConceptosVentaPayload([
      { id: 1, concepto: "THC", cantidad: 2, precioUnitario: 100, moneda: "MXN" },
    ]);
    expect(result[0].contenedor_id).toBeNull();
    expect(result[0].moneda).toBe("MXN");
  });

  it("[EE-09] múltiples items: filtra solo los que tienen concepto", () => {
    const result = buildConceptosVentaPayload([
      { id: 1, concepto: "Flete", cantidad: 1, precioUnitario: 1000, moneda: "USD" },
      { id: 2, concepto: "", cantidad: 1, precioUnitario: 500, moneda: "USD" },
      { id: 3, concepto: "Seguro", cantidad: 1, precioUnitario: 50, moneda: "USD" },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.descripcion)).toEqual(["Flete", "Seguro"]);
  });
});

describe("embarque.extra — buildConceptosCostoPayload", () => {
  it("[EE-10] contenedor_id y moneda MXN se mapean correctamente", () => {
    const result = buildConceptosCostoPayload(
      [{ id: 1, proveedorId: "p1", concepto: "Almacenaje", monto: 300, moneda: "MXN", contenedorId: "cnt-1" }],
      [{ id: "p1", nombre: "Maersk" }],
    );
    expect(result[0].contenedor_id).toBe("cnt-1");
    expect(result[0].moneda).toBe("MXN");
    expect(result[0].proveedor_nombre).toBe("Maersk");
  });
});
