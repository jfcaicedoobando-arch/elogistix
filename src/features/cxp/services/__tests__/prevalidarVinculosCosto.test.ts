import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { detectarSobreasignacionCosto } from "../prevalidarVinculosCosto";

const costo = { id: "c1", concepto: "Flete marítimo LCL", monto: 556.80, moneda: "USD" };

describe("tope de vínculo por costo antes de crear factura", () => {
  it("bloquea 700 USD sobre un costo de 556.80 y explica el máximo de 584.64", () => {
    const mensaje = detectarSobreasignacionCosto("USD", { c1: { monto: 700 } }, [costo], []);
    expect(mensaje).toContain("584.64 USD");
    expect(mensaje).toContain("5%");
  });

  it("descuenta asignaciones anteriores del máximo permitido", () => {
    const mensaje = detectarSobreasignacionCosto(
      "USD", { c1: { monto: 100 } }, [costo], [{ concepto_costo_id: "c1", monto: 500 }],
    );
    expect(mensaje).toContain("84.64 USD");
  });

  it("permite el límite exacto y no compara importes de monedas distintas", () => {
    expect(detectarSobreasignacionCosto("USD", { c1: { monto: 584.64 } }, [costo], [])).toBeNull();
    expect(detectarSobreasignacionCosto("MXN", { c1: { monto: 700 } }, [costo], [])).toBeNull();
  });

  it("AUD72: descuenta el subtotal de 3 unidades de MXN10 al validar otro vínculo", () => {
    const costoMxn = { ...costo, monto: 40, moneda: "MXN" };
    const existentes = [{ concepto_costo_id: "c1", monto: 10, cantidad: 3 }];
    expect(detectarSobreasignacionCosto("MXN", { c1: { monto: 12 } }, [costoMxn], existentes)).toBeNull();
    expect(detectarSobreasignacionCosto("MXN", { c1: { monto: 12.2 } }, [costoMxn], existentes))
      .toContain("12.00 MXN");
  });

  it("AUD72: cantidades fraccionarias y cero legado mantienen el contrato del guard", () => {
    const costoMxn = { ...costo, monto: 20, moneda: "MXN" };
    const existentes = [
      { concepto_costo_id: "c1", monto: 8, cantidad: 0.125 },
      { concepto_costo_id: "c1", monto: 2, cantidad: 0 },
    ];
    expect(detectarSobreasignacionCosto("MXN", { c1: { monto: 18 } }, [costoMxn], existentes)).toBeNull();
    expect(detectarSobreasignacionCosto("MXN", { c1: { monto: 18.01 } }, [costoMxn], existentes))
      .toContain("18.00 MXN");
  });
});
