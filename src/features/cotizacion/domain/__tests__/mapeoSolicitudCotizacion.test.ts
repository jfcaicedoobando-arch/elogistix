import { describe, expect, it } from "vitest";
import { mapearSolicitudACotizacion, pesoSolicitudAKg } from "../mapeoSolicitudCotizacion";

describe("mapearSolicitudACotizacion", () => {
  it("IMO sí se vuelve Mercancía Peligrosa", () => {
    expect(mapearSolicitudACotizacion({ imo: true }).tipoCarga).toBe("Mercancía Peligrosa");
  });
  it("IMO no se vuelve Carga General", () => {
    expect(mapearSolicitudACotizacion({ imo: false }).tipoCarga).toBe("Carga General");
  });
  it("commodity pasa a descripción de la mercancía", () => {
    expect(mapearSolicitudACotizacion({ commodity: " Llantas " }).descripcionMercancia).toBe("Llantas");
  });
  it("no estibable se anota en descripción adicional", () => {
    expect(mapearSolicitudACotizacion({ estibable: false }).descripcionAdicional).toBe("No estibable");
  });
  it("tipo de operación y sector válidos viajan; inválidos no", () => {
    expect(mapearSolicitudACotizacion({ tipo_operacion: "Importación", sector_economico: "Automotriz" }))
      .toMatchObject({ tipo: "Importación", sectorEconomico: "Automotriz" });
    expect(mapearSolicitudACotizacion({ tipo_operacion: "X", sector_economico: "Y" })).toEqual({});
  });
});

describe("pesoSolicitudAKg", () => {
  it("convierte toneladas y libras a kg", () => {
    expect(pesoSolicitudAKg("2", "t")).toBe(2000);
    expect(pesoSolicitudAKg("100", "lb")).toBe(45.36);
  });
  it("rechaza texto o cero", () => {
    expect(pesoSolicitudAKg("aprox", "kg")).toBeNull();
    expect(pesoSolicitudAKg("0", "kg")).toBeNull();
  });
});
