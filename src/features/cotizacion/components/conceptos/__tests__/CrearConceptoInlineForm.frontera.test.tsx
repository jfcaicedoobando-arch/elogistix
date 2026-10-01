import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import type { ReactNode } from "react";
import { CrearConceptoInlineForm } from "../CrearConceptoInlineForm";
import { AVISO_IVA_FRONTERA_DESHABILITADO } from "@/lib/financial/ivaFrontera";
import type { ProductoCatalogo } from "@/features/cotizacion/services/productosCatalogoService";
import { createWrapper } from "@/test/utils/queryWrapper";

const estado = vi.hoisted(() => ({
  habilitada: false,
  elegir: null as ((valor: string) => void) | null,
  crear: vi.fn(),
  notificar: vi.fn(),
}));
vi.mock("@/features/configuracion", () => ({
  useIvaFronteraHabilitada: () => estado.habilitada,
}));
vi.mock("@/features/cotizacion/services/productosCatalogoService", () => ({
  crearProductoCatalogo: estado.crear,
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: estado.notificar }));
// Conservamos el formulario, el selector de dominio y el diálogo reales.
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: { children: ReactNode; onValueChange: (v: string) => void }) => {
    estado.elegir = onValueChange;
    return <div>{children}</div>;
  },
  SelectTrigger: ({ children, ...props }: { children: ReactNode }) => <button type="button" {...props}>{children}</button>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value, disabled }: { children: ReactNode; value: string; disabled?: boolean }) => (
    <button type="button" disabled={disabled} data-testid={`opcion-${value}`}
      onClick={() => estado.elegir?.(value)}>{children}</button>
  ),
}));

const producto: ProductoCatalogo = {
  id: "qa-producto", nombre: "Maniobras mock", clave_sat: "78101800",
  clave_unidad_sat: "E48", nombre_unidad: null, tipo_iva: "gravado_16", tasa_iva_default: 0.16,
};
function preparar(onCreado = vi.fn()) {
  const props = { organizationId: "qa-organizacion", nombreInicial: "  Maniobras mock  ", onCreado, onCancel: vi.fn() };
  const wrapper = createWrapper();
  const { result } = renderHook(() => useQueryClient(), { wrapper });
  const vista = render(<CrearConceptoInlineForm {...props} />, { wrapper });
  fireEvent.change(screen.getByLabelText("Clave SAT"), { target: { value: " 78101800 " } });
  return { ...vista, props, onCreado, client: result.current };
}
beforeEach(() => {
  estado.habilitada = false;
  estado.elegir = null;
  estado.crear.mockReset().mockResolvedValue(producto);
  estado.notificar.mockReset();
});

describe("Alta rápida de productos: IVA fronterizo", () => {
  it("actualiza inmediatamente el catálogo de la organización sin afectar otra", async () => {
    const { client, onCreado } = preparar();
    const key = queryKeys.productosCatalogo("qa-organizacion");
    const ajeno = queryKeys.productosCatalogo("otra-organizacion");
    // El wrapper de pruebas usa gcTime=0; aquí observamos la caché tras el alta.
    client.setQueryDefaults(key, { gcTime: Infinity });
    client.setQueryDefaults(ajeno, { gcTime: Infinity });
    client.setQueryData(ajeno, [{ ...producto, id: "otro" }]);
    fireEvent.click(screen.getByRole("button", { name: "Crear concepto" }));
    await waitFor(() => expect(onCreado).toHaveBeenCalledWith(producto));
    expect(client.getQueryData(key)).toEqual([producto]);
    expect(client.getQueryData(ajeno)).toEqual([expect.objectContaining({ id: "otro" })]);
  });
  it("deshabilita el 8% y explica la configuración necesaria", () => {
    preparar();
    expect(screen.getByTestId("opcion-gravado_8")).toBeDisabled();
    expect(screen.getByTestId("opcion-gravado_8")).toHaveTextContent(AVISO_IVA_FRONTERA_DESHABILITADO);
  });

  it("ignora la selección forzada del 8% si no está habilitado", async () => {
    preparar();
    act(() => estado.elegir?.("gravado_8"));
    fireEvent.click(screen.getByRole("button", { name: "Crear concepto" }));
    await waitFor(() => expect(estado.crear).toHaveBeenCalledExactlyOnceWith("qa-organizacion", {
      nombre: "Maniobras mock", clave_sat: "78101800", clave_unidad_sat: "E48", tipo_iva: "gravado_16",
    }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("con 8% habilitado exige confirmación antes de crear y aplicar el producto", async () => {
    estado.habilitada = true;
    estado.crear.mockResolvedValue({ ...producto, tipo_iva: "gravado_8", tasa_iva_default: 0.08 });
    const { onCreado } = preparar();
    fireEvent.click(screen.getByTestId("opcion-gravado_8"));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(estado.crear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmo la elegibilidad" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear concepto" }));
    await waitFor(() => expect(onCreado).toHaveBeenCalledExactlyOnceWith({ ...producto, tipo_iva: "gravado_8", tasa_iva_default: 0.08 }));
    expect(estado.crear).toHaveBeenCalledExactlyOnceWith("qa-organizacion", {
      nombre: "Maniobras mock", clave_sat: "78101800", clave_unidad_sat: "E48", tipo_iva: "gravado_8",
    });
  });

  it("cancelar la confirmación conserva el 16% inicial", async () => {
    estado.habilitada = true;
    preparar();
    fireEvent.click(screen.getByTestId("opcion-gravado_8"));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear concepto" }));
    await waitFor(() => expect(estado.crear).toHaveBeenCalled());
    expect(estado.crear.mock.calls[0][1].tipo_iva).toBe("gravado_16");
  });

  it("bloquea el guardado si la configuración se apaga después de confirmar 8%", () => {
    estado.habilitada = true;
    const { rerender, props } = preparar();
    fireEvent.click(screen.getByTestId("opcion-gravado_8"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmo la elegibilidad" }));
    estado.habilitada = false;
    rerender(<CrearConceptoInlineForm {...props} />);
    expect(screen.getByRole("button", { name: "Crear concepto" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(AVISO_IVA_FRONTERA_DESHABILITADO);
    fireEvent.click(screen.getByRole("button", { name: "Crear concepto" }));
    expect(estado.crear).not.toHaveBeenCalled();
  });

  it("bloquea una confirmación tardía si el estímulo se desactiva con el diálogo abierto", () => {
    estado.habilitada = true;
    const { rerender, props } = preparar();
    fireEvent.click(screen.getByTestId("opcion-gravado_8"));
    estado.habilitada = false;
    rerender(<CrearConceptoInlineForm {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmo la elegibilidad" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear concepto" }));
    expect(estado.crear).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(AVISO_IVA_FRONTERA_DESHABILITADO);
  });

  it.each(["gravado_16", "tasa_0", "exento", "no_objeto"] as const)("mantiene el alta de %s sin habilitar 8%", async (tipo) => {
    preparar();
    fireEvent.click(screen.getByTestId(`opcion-${tipo}`));
    fireEvent.click(screen.getByRole("button", { name: "Crear concepto" }));
    await waitFor(() => expect(estado.crear).toHaveBeenCalledExactlyOnceWith("qa-organizacion", {
      nombre: "Maniobras mock", clave_sat: "78101800", clave_unidad_sat: "E48", tipo_iva: tipo,
    }));
  });

  it("no inserta dos veces mientras hay un alta pendiente", async () => {
    let resolver!: (p: ProductoCatalogo) => void;
    estado.crear.mockReturnValue(new Promise<ProductoCatalogo>((resolve) => { resolver = resolve; }));
    const { onCreado } = preparar();
    const crear = screen.getByRole("button", { name: "Crear concepto" });
    fireEvent.click(crear);
    expect(crear).toBeDisabled();
    fireEvent.click(crear);
    expect(estado.crear).toHaveBeenCalledTimes(1);
    await act(async () => resolver(producto));
    expect(onCreado).toHaveBeenCalledExactlyOnceWith(producto);
  });

  it("un error de alta no aplica ningún producto y muestra el aviso existente", async () => {
    const error = new Error("fallo mock");
    estado.crear.mockRejectedValue(error);
    const { onCreado } = preparar();
    fireEvent.click(screen.getByRole("button", { name: "Crear concepto" }));
    await waitFor(() => expect(estado.notificar).toHaveBeenCalledWith(undefined, expect.objectContaining({ error })));
    expect(onCreado).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crear concepto" })).toBeEnabled();
  });
});
