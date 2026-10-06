/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mutate, validarLimite, registrarExcesoCredito } = vi.hoisted(() => ({ mutate: vi.fn(), validarLimite: vi.fn(), registrarExcesoCredito: vi.fn() }));
vi.mock("@/hooks/shared/useOrgActiva", () => ({ useOrgActiva: () => ({ organizationId: "org-1" }) }));
vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/features/facturacion/hooks/useCrearFacturaManual", () => ({ useCrearFacturaManual: () => ({ mutate, isPending: false }) }));
vi.mock("@/features/cliente/hooks/useValidarLimiteCredito", () => ({ useValidarLimiteCredito: () => validarLimite, registrarExcesoCredito }));
vi.mock("@/features/facturacion/hooks/useClientesFiscalOpts", () => ({ useClientesFiscalOpts: () => ({ data: [{ id: "c1", nombre: "Cliente", rfc: "RFC", codigo_postal: "06000", regimen_fiscal: "601", dias_credito: 0 }] }) }));
import { useFacturaManualForm } from "../useFacturaManualForm";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};
function setup() {
  const hook = renderHook(() => useFacturaManualForm(true));
  act(() => {
    hook.result.current.onClienteChange("c1");
    hook.result.current.setConceptos([{ descripcion: "Servicio", cantidad: 1, precio_unitario: 100, clave_sat: "78101800", tipo_iva: "gravado_16" }]);
  });
  return hook;
}
beforeEach(() => { vi.clearAllMocks(); validarLimite.mockResolvedValue(null); });

describe("AUD110: bloqueo e identidad de captura manual", () => {
  it("doble clic durante validación lenta sólo valida y crea una vez", async () => {
    const validacion = deferred<null>();
    validarLimite.mockReturnValue(validacion.promise);
    const { result } = setup();
    let submit!: Promise<void>;
    act(() => {
      submit = result.current.handleSubmit(false);
      void result.current.handleSubmit(false);
      void result.current.handleSubmit(true);
    });
    expect(result.current.isPending).toBe(true);
    expect(validarLimite).toHaveBeenCalledTimes(1);
    expect(mutate).not.toHaveBeenCalled();
    await act(async () => { validacion.resolve(null); await submit; });
    expect(mutate).toHaveBeenCalledTimes(1);
    await act(() => result.current.handleSubmit(false));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("reintento tras error reutiliza requestId; descartar y nueva captura lo renueva", async () => {
    const { result } = setup();
    await act(() => result.current.handleSubmit(false));
    const first = mutate.mock.calls[0][0].input.requestId;
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    act(() => mutate.mock.calls[0][1].onSettled());
    await act(() => result.current.handleSubmit(false));
    expect(mutate.mock.calls[1][0].input.requestId).toBe(first);
    act(() => { mutate.mock.calls[1][1].onSettled(); result.current.reset(); });
    act(() => {
      result.current.onClienteChange("c1");
      result.current.setConceptos([{ descripcion: "Otro servicio", cantidad: 1, precio_unitario: 100, clave_sat: "78101800" }]);
    });
    await act(() => result.current.handleSubmit(false));
    expect(mutate.mock.calls[2][0].input.requestId).not.toBe(first);
  });

  it("confirmación de exceso también bloquea doble clic y conserva los datos validados", async () => {
    validarLimite.mockResolvedValue({ rebasa: true, exposicion: { limiteMxn: 50 }, totalProyectadoMxn: 116, excedentePotencialMxn: 66 });
    const registrar = deferred<void>();
    registrarExcesoCredito.mockReturnValue(registrar.promise);
    const { result } = setup();
    await act(() => result.current.handleSubmit(false));
    await act(() => result.current.handleSubmit(false));
    expect(validarLimite).toHaveBeenCalledTimes(1);
    act(() => result.current.setNotas("Edición mientras se confirma"));
    let confirmacion!: Promise<void>;
    act(() => { confirmacion = result.current.onConfirmarExceso(); void result.current.onConfirmarExceso(); });
    expect(registrarExcesoCredito).toHaveBeenCalledTimes(1);
    await act(async () => { registrar.resolve(); await confirmacion; });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].input.notas).toBe("");
  });
});
