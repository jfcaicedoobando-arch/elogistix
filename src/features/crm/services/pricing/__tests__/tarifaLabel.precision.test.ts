import { describe, expect, it } from "vitest";
import { etiquetaTarifa } from "../tarifasParaPricing";

describe("pricing tariff label retains up to three decimal places", () => {
  it.each<[number, string]>([[1.2345, "1.235"], [1.2, "1.2"], [1, "1"]])("formats %s without forcing trailing zeroes", (flete, label) => {
    expect(etiquetaTarifa({ id: "tarifa", naviera_id: null, naviera: "Naviera", agente: null,
      moneda: "USD", flete_base: flete, transit_time_dias: null }))
      .toBe(`Naviera · USD ${label}`);
  });
});
