import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { divergenciasResumenPago, type CalculoRep } from "./paridadResumen.ts";

const base: CalculoRep = {
  installment: 1,
  last_balance: 11600,
  amount: 5800,
  taxes: [{ type: "IVA", rate: 0.16, base: 5000, withholding: false }],
};

Deno.test("pago parcial en paridad no reporta divergencias", () => {
  const d = divergenciasResumenPago(base, {
    installment: 1,
    last_balance: 11600,
    amount: 5800,
    taxes: [{ type: "IVA", rate: 0.16, base: 5000, withholding: false }],
  });
  assertEquals(d, []);
});

Deno.test("ultima parcialidad: saldo anterior distinto se detecta", () => {
  const local: CalculoRep = { ...base, installment: 2, last_balance: 5800, amount: 5800 };
  const d = divergenciasResumenPago(local, { installment: 2, last_balance: 5000, amount: 5800 });
  assertEquals(d.length, 1);
  assertEquals(d[0].startsWith("Saldo anterior"), true);
});

Deno.test("nota de credito aplicada localmente diverge del saldo del proveedor", () => {
  // El ERP restó una NC de 1,160 antes del pago; el proveedor no la conoce.
  const local: CalculoRep = { ...base, last_balance: 10440 };
  const d = divergenciasResumenPago(local, { installment: 1, last_balance: 11600, amount: 5800 });
  assertEquals(d.length, 1);
  assertEquals(d[0].includes("10440.00"), true);
});

Deno.test("parcialidad distinta se reporta aunque los montos cuadren", () => {
  const d = divergenciasResumenPago(base, { installment: 3, last_balance: 11600, amount: 5800 });
  assertEquals(d, ["Parcialidad: local 1 vs proveedor 3"]);
});

Deno.test("mezcla de tasas: falta un grupo y sobra otro", () => {
  const local: CalculoRep = {
    ...base,
    taxes: [
      { type: "IVA", rate: 0.16, base: 3000, withholding: false },
      { type: "IVA", rate: 0, base: 2000, withholding: false },
    ],
  };
  const d = divergenciasResumenPago(local, {
    taxes: [{ type: "IVA", rate: 0.16, base: 3000, withholding: false }],
  });
  assertEquals(d, ["IVA trasladado 0.00% no aparece en el resumen del proveedor"]);
});

Deno.test("retenciones: base prorrateada distinta se reporta", () => {
  const local: CalculoRep = {
    ...base,
    taxes: [
      { type: "IVA", rate: 0.16, base: 5000, withholding: false },
      { type: "IVA", rate: 0.04, base: 5000, withholding: true },
    ],
  };
  const d = divergenciasResumenPago(local, {
    taxes: [
      { type: "IVA", rate: 0.16, base: 5000, withholding: false },
      { type: "IVA", rate: 0.04, base: 2500, withholding: true },
    ],
  });
  assertEquals(d.length, 1);
  assertEquals(d[0].includes("retenido"), true);
});

Deno.test("moneda extranjera: centavos dentro de tolerancia no divergen", () => {
  const local: CalculoRep = {
    installment: 1,
    last_balance: 1160.0,
    amount: 580.0,
    taxes: [{ type: "IVA", rate: 0.16, base: 500.0, withholding: false }],
  };
  const d = divergenciasResumenPago(local, {
    installment: 1,
    last_balance: 1160.01,
    amount: 579.99,
    taxes: [{ type: "IVA", rate: 0.16, base: 500.01, withholding: false }],
  });
  assertEquals(d, []);
});

Deno.test("resumen ausente no inventa divergencias", () => {
  assertEquals(divergenciasResumenPago(base, null), []);
  assertEquals(divergenciasResumenPago(base, {}), []);
});
