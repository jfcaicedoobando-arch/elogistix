import { describe, it, expect } from "vitest";
import {
  mapNavieraToJsonCargo,
  listNavierasSoportadas,
  JSONCARGO_SHIPPING_LINES,
} from "@/lib/jsoncargo/navieras";

describe("navieras → JSONCargo mapping", () => {
  it("retorna null para entradas vacías", () => {
    expect(mapNavieraToJsonCargo(null)).toBeNull();
    expect(mapNavieraToJsonCargo(undefined)).toBeNull();
    expect(mapNavieraToJsonCargo("")).toBeNull();
  });

  it("mapea variantes comunes a la línea correcta", () => {
    expect(mapNavieraToJsonCargo("Maersk Line")).toBe("MAERSK");
    expect(mapNavieraToJsonCargo("Hapag-Lloyd AG")).toBe("HAPAG_LLOYD");
    expect(mapNavieraToJsonCargo("HMM")).toBe("HMM");
    expect(mapNavieraToJsonCargo("Hyundai Merchant Marine")).toBe("HMM");
    expect(mapNavieraToJsonCargo("ONE")).toBe("ONE");
    expect(mapNavieraToJsonCargo("Ocean Network Express")).toBe("ONE");
    expect(mapNavieraToJsonCargo("Evergreen Marine")).toBe("EVERGREEN");
    expect(mapNavieraToJsonCargo("EGLV")).toBe("EVERGREEN");
    expect(mapNavieraToJsonCargo("MSC Mediterranean")).toBe("MSC");
    expect(mapNavieraToJsonCargo("CMA CGM")).toBe("CMA_CGM");
    expect(mapNavieraToJsonCargo("COSCO Shipping")).toBe("COSCO");
    expect(mapNavieraToJsonCargo("OOCL")).toBe("COSCO");
    expect(mapNavieraToJsonCargo("ZIM Integrated")).toBe("ZIM");
    expect(mapNavieraToJsonCargo("Yang Ming")).toBe("YANG_MING");
    expect(mapNavieraToJsonCargo("PIL")).toBe("PIL");
  });

  it("retorna null para navieras desconocidas", () => {
    expect(mapNavieraToJsonCargo("Naviera Fantasma")).toBeNull();
    expect(mapNavieraToJsonCargo("xyz")).toBeNull();
  });

  it("listNavierasSoportadas devuelve todas las líneas con label legible", () => {
    const list = listNavierasSoportadas();
    expect(list).toHaveLength(JSONCARGO_SHIPPING_LINES.length);
    for (const item of list) {
      expect(item.value).toBeDefined();
      expect(item.label).toMatch(/^[A-Za-z0-9 ()-]+$/);
    }
  });
});
