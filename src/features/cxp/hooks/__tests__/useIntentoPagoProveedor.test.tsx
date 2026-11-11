import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PagoProveedorResultadoIncierto } from "@/features/cxp/services";
import { useIntentoPagoProveedor } from "../useIntentoPagoProveedor";

const { mutateAsync, scope } = vi.hoisted(() => ({ mutateAsync: vi.fn(), scope: { org: "org" } }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "usuario" } }) }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: scope.org }) }));
vi.mock("../usePagosProveedor", () => ({
  useRegistrarPagoProveedor: () => ({ mutateAsync, isPending: false }),
}));

it("reabre el intento incierto con la misma llave y datos, incluso tras remontar", async () => {
  const facturaId = "factura";
  const datos = {
    proveedor_factura_id: facturaId, fecha_pago: "2026-11-10", monto: 100,
    moneda: "MXN" as const, tipo_cambio_usd: null, metodo_pago: "Transferencia",
  };
  mutateAsync.mockRejectedValueOnce(new PagoProveedorResultadoIncierto());
  const original = renderHook(() => useIntentoPagoProveedor(facturaId));
  await act(async () => {
    await expect(original.result.current.confirmar(datos)).rejects.toBeInstanceOf(PagoProveedorResultadoIncierto);
  });
  const primero = mutateAsync.mock.calls[0][0];
  expect(original.result.current.intento?.estado).toBe("incierto");
  original.unmount();

  scope.org = "otra-org";
  const otraOrganizacion = renderHook(() => useIntentoPagoProveedor(facturaId));
  expect(otraOrganizacion.result.current.intento).toBeNull();
  otraOrganizacion.unmount();

  scope.org = "org";
  const reabierto = renderHook(() => useIntentoPagoProveedor(facturaId));
  expect(reabierto.result.current.intento?.input).toEqual(primero);
  mutateAsync.mockResolvedValueOnce({ estado: "detalle_pendiente", pagoId: "registrado" });
  await act(async () => {
    await expect(reabierto.result.current.confirmar()).resolves.toEqual({
      estado: "detalle_pendiente", pagoId: "registrado",
    });
  });
  expect(mutateAsync.mock.calls[1][0]).toEqual(primero);
  expect(reabierto.result.current.intento).toBeNull();
});
