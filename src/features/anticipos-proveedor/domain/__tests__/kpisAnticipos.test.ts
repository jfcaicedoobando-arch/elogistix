/**
 * MNY P1.3 — un anticipo devuelto no es vigente y lo devuelto no es "aplicado
 * a facturas" (antes `monto - saldo_disponible` reportaba la devolución como
 * aplicación).
 */
import { describe, it, expect } from "vitest";
import { calcularKpisAnticipos } from "../kpisAnticipos";
import { toRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";

type FilaCruda = Parameters<typeof toRow>[0];

const base = {
  id: "a1",
  moneda: "MXN",
  estado: "vigente",
  monto: 1000,
  saldo_disponible: 1000,
  monto_devuelto: 0,
} as unknown as FilaCruda;

describe("toRow · devolución vs aplicación", () => {
  it("devolución total no cuenta como aplicado", () => {
    const r = toRow({ ...base, estado: "devuelto", saldo_disponible: 0, monto_devuelto: 1000 } as FilaCruda);
    expect(r.devuelto).toBe(1000);
    expect(r.aplicado).toBe(0);
    expect(r.disponible).toBe(0);
  });

  it("devolución parcial sólo cuenta lo realmente aplicado", () => {
    // 1000 anticipados, 300 aplicados a facturas, 700 devueltos.
    const r = toRow({ ...base, estado: "devuelto", saldo_disponible: 0, monto_devuelto: 700 } as FilaCruda);
    expect(r.aplicado).toBe(300);
    expect(r.devuelto).toBe(700);
  });

  it("anticipo normal aplica la diferencia contra el disponible", () => {
    const r = toRow({ ...base, saldo_disponible: 400 } as FilaCruda);
    expect(r.aplicado).toBe(600);
    expect(r.devuelto).toBe(0);
  });
});

describe("calcularKpisAnticipos", () => {
  const filas = [
    { estado: "vigente", moneda: "MXN", monto: 1000, disponible: 400, aplicado: 600 },
    { estado: "devuelto", moneda: "MXN", monto: 1000, disponible: 0, aplicado: 300 },
    { estado: "cancelado", moneda: "MXN", monto: 500, disponible: 500, aplicado: 0 },
    { estado: "vigente", moneda: "USD", monto: 200, disponible: 200, aplicado: 0 },
  ];

  it("excluye devueltos del total anticipado y del disponible", () => {
    const k = calcularKpisAnticipos(filas);
    expect(k.anticipado).toEqual([
      ["MXN", 1000],
      ["USD", 200],
    ]);
    expect(k.disponible).toEqual([
      ["MXN", 400],
      ["USD", 200],
    ]);
    expect(k.pendientes).toBe(2);
  });

  it("suma lo aplicado real del devuelto pero no su devolución", () => {
    const k = calcularKpisAnticipos(filas);
    expect(k.aplicado).toEqual([["MXN", 900]]);
  });

  it("ignora por completo los cancelados", () => {
    const k = calcularKpisAnticipos([filas[2]]);
    expect(k.vigentes).toEqual([]);
    expect(k.aplicado).toEqual([]);
  });
});
