import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  from: vi.fn(),
  cuenta: { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() },
  factura: { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() },
  insert: vi.fn(),
  registrarActividad: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mock.from } }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: mock.registrarActividad }));

import {
  crearMovimientoBancarioPago,
  ERROR_CUENTA_NO_DISPONIBLE,
  ERROR_TC_REQUERIDO,
  type MovimientoPagoInput,
} from "../pagoProveedorMovimiento";

type CuentaFixture = {
  id: string;
  organization_id: string;
  activa: boolean | null;
  deleted_at: string | null;
  moneda: string | null;
};
let cuenta: CuentaFixture | null;
const INPUT: MovimientoPagoInput = {
  pagoId: "pago-fixture",
  organizationId: "org-fixture",
  cuentaBancariaId: "cuenta-fixture",
  facturaId: "factura-fixture",
  fechaPago: "2026-10-13",
  monto: 100,
  moneda: "USD",
  tipoCambioUsd: 17,
  referencia: "ref-fixture",
  userId: "user-fixture",
};

beforeEach(() => {
  vi.resetAllMocks();
  cuenta = {
    id: INPUT.cuentaBancariaId,
    organization_id: INPUT.organizationId,
    activa: true,
    deleted_at: null,
    moneda: "MXN",
  };
  mock.cuenta.select.mockReturnValue(mock.cuenta);
  mock.cuenta.eq.mockReturnValue(mock.cuenta);
  mock.cuenta.is.mockReturnValue(mock.cuenta);
  // El mock aplica los filtros, no sólo devuelve un resultado predeterminado.
  // Quitar id/org/activa/deleted_at permite pasar una fila inválida y falla el test.
  mock.cuenta.maybeSingle.mockImplementation(async () => {
    const filtros = [...mock.cuenta.eq.mock.calls, ...mock.cuenta.is.mock.calls];
    const coincide = cuenta && filtros.every(([key, value]) => cuenta?.[key as keyof CuentaFixture] === value);
    return { data: coincide ? cuenta : null, error: null };
  });
  mock.factura.select.mockReturnValue(mock.factura);
  mock.factura.eq.mockReturnValue(mock.factura);
  mock.factura.maybeSingle.mockResolvedValue({
    data: { folio_proveedor: "F-1", proveedores: { nombre: "Proveedor fixture" } }, error: null,
  });
  mock.insert.mockResolvedValue({ error: null });
  mock.registrarActividad.mockResolvedValue(undefined);
  mock.from.mockImplementation((table: string) => {
    if (table === "cuentas_bancarias") return mock.cuenta;
    if (table === "proveedor_facturas") return mock.factura;
    if (table === "bbva_movimientos") return { insert: mock.insert };
    throw new Error(`Tabla inesperada: ${table}`);
  });
});

async function expectCuentaNoDisponible(input: MovimientoPagoInput = INPUT) {
  await expect(crearMovimientoBancarioPago(input)).resolves.toEqual({ ok: false, error: ERROR_CUENTA_NO_DISPONIBLE });
  expect(ERROR_CUENTA_NO_DISPONIBLE).not.toBe(ERROR_TC_REQUERIDO);
  expect(mock.from).not.toHaveBeenCalledWith("bbva_movimientos");
  expect(mock.insert).not.toHaveBeenCalled();
  expect(mock.registrarActividad).not.toHaveBeenCalled();
}

describe("crearMovimientoBancarioPago legado · cuenta disponible antes del cargo", () => {
  it("rechaza data:null sin error (inexistente o no visible por RLS)", async () => {
    cuenta = null;
    await expectCuentaNoDisponible();
  });

  it.each([
    ["id diferente", { id: "otra-cuenta" }],
    ["otra organización", { organization_id: "otra-org" }],
    ["inactiva", { activa: false }],
    ["activa desconocida", { activa: null }],
    ["eliminada", { deleted_at: "2026-10-12T00:00:00Z" }],
    ["moneda null", { moneda: null }],
    ["moneda vacía", { moneda: "" }],
    ["moneda en blanco", { moneda: "   " }],
  ] satisfies Array<[string, Partial<CuentaFixture>]>)("rechaza cuenta %s sin insertar", async (_caso, cambio) => {
    cuenta = { ...cuenta!, ...cambio };
    await expectCuentaNoDisponible();
  });

  it.each(["", "   "])("rechaza id de cuenta vacío (%j) antes de consultarla", async (cuentaBancariaId) => {
    await expectCuentaNoDisponible({ ...INPUT, cuentaBancariaId });
    expect(mock.from).not.toHaveBeenCalledWith("cuentas_bancarias");
  });

  it("rechaza organización vacía", async () => {
    await expectCuentaNoDisponible({ ...INPUT, organizationId: "" });
    expect(mock.from).not.toHaveBeenCalledWith("cuentas_bancarias");
  });

  it("rechaza error PostgREST incluso si viene acompañado de datos", async () => {
    mock.cuenta.maybeSingle.mockResolvedValue({ data: cuenta, error: { message: "permission denied", code: "42501" } });
    await expectCuentaNoDisponible();
  });

  it("rechaza una lectura que lanza sin convertirla en error de TC", async () => {
    mock.cuenta.maybeSingle.mockRejectedValue(new Error("network unavailable"));
    await expectCuentaNoDisponible();
  });

  it("prioriza cuenta no disponible sobre TC ausente", async () => {
    cuenta = null;
    await expectCuentaNoDisponible({ ...INPUT, tipoCambioUsd: null });
  });

  it("consulta id, organización, activa y deleted_at en la cuenta", async () => {
    await expect(crearMovimientoBancarioPago(INPUT)).resolves.toEqual({ ok: true });
    expect(mock.cuenta.select).toHaveBeenCalledWith("moneda");
    expect(mock.cuenta.eq.mock.calls).toEqual([
      ["id", INPUT.cuentaBancariaId], ["organization_id", INPUT.organizationId], ["activa", true],
    ]);
    expect(mock.cuenta.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mock.cuenta.maybeSingle).toHaveBeenCalledOnce();
  });

  it.each([
    ["USD", "MXN", 100, 17, 1700],
    ["MXN", "USD", 1700, 17, 100],
    ["USD", "USD", 100, null, 100],
    ["MXN", "MXN", 100, null, 100],
  ] as const)("conserva %s → %s (%s, TC %s) = %s", async (moneda, monedaCuenta, monto, tipoCambioUsd, cargo) => {
    cuenta!.moneda = monedaCuenta;
    await expect(crearMovimientoBancarioPago({ ...INPUT, moneda, monto, tipoCambioUsd })).resolves.toEqual({ ok: true });
    expect(mock.insert).toHaveBeenCalledOnce();
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: INPUT.organizationId,
      cuenta_bancaria_id: INPUT.cuentaBancariaId,
      pago_proveedor_id: INPUT.pagoId,
      hash_dedupe: `pago-${INPUT.pagoId}`,
      cargo,
      abono: 0,
      estado_conciliacion: "Conciliado",
    }));
    expect(mock.registrarActividad).toHaveBeenCalledWith(expect.objectContaining({
      detalles: { cuentaBancariaId: INPUT.cuentaBancariaId, monto: cargo },
    }));
  });

  it.each([null, 0, -1])("mantiene el rechazo de TC %s con cuenta válida de otra moneda", async (tipoCambioUsd) => {
    await expect(crearMovimientoBancarioPago({ ...INPUT, tipoCambioUsd })).resolves.toEqual({ ok: false, error: ERROR_TC_REQUERIDO });
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.registrarActividad).not.toHaveBeenCalled();
  });

  it("preserva errores de INSERT y omite bitácora de éxito", async () => {
    mock.insert.mockResolvedValue({ error: { message: "LC_MOVIMIENTO_RECHAZADO" } });
    await expect(crearMovimientoBancarioPago(INPUT)).resolves.toEqual({ ok: false, error: "LC_MOVIMIENTO_RECHAZADO" });
    expect(mock.insert).toHaveBeenCalledOnce();
    expect(mock.registrarActividad).not.toHaveBeenCalled();
  });
});
