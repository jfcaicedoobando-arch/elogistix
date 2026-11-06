import { describe, expect, it } from "vitest";
import { puedeCotizarYGuardar, rutaCotizacionTarifa } from "../../domain/cotizarGuardarTarifa";

describe("Cotizar y guardar tarifa (clientes especiales)", () => {
  it("sólo coordinador logístico, gerente de operaciones y administradores", () => {
    expect(puedeCotizarYGuardar("coordinador_logistico")).toBe(true);
    expect(puedeCotizarYGuardar("gerente_operaciones")).toBe(true);
    expect(puedeCotizarYGuardar("vendedor")).toBe(false);
    expect(puedeCotizarYGuardar("ejecutivo_pricing")).toBe(false);
    expect(puedeCotizarYGuardar(null)).toBe(false);
  });

  it("abre la cotización nueva con la tarifa y el cliente", () => {
    expect(rutaCotizacionTarifa("t1", "c1")).toBe("/cotizaciones/nueva?tarifa=t1&cliente=c1");
  });
});
