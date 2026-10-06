import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import type { UseFormRegister } from "react-hook-form";
import type { RegistrarAnticipoFormInput } from "../registrarAnticipo.schema";
import { RegistrarAnticipoDialog } from "../RegistrarAnticipoDialog";

const { registrar } = vi.hoisted(() => ({ registrar: vi.fn() }));
vi.mock("@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations", () => ({
  useRegistrarAnticipo: () => ({ mutateAsync: registrar, isPending: false }),
}));
vi.mock("@/features/anticipos-proveedor/hooks/useRegistrarAnticipoDefaults", () => ({
  useRegistrarAnticipoDefaults: () => ({ cuentasDeMoneda: [] }),
}));
vi.mock("../RegistrarAnticipoFields", () => ({
  RegistrarAnticipoFields: ({ register }: { register: UseFormRegister<RegistrarAnticipoFormInput> }) =>
    <input aria-label="Monto" {...register("monto")} />,
}));

describe("Registrar anticipo: proteger captura sin registrar dinero", () => {
  it("Cancelar pide descartar y Seguir capturando conserva MXN25", () => {
    const cerrar = vi.fn();
    render(<BrowserRouter><RegistrarAnticipoDialog open onOpenChange={cerrar} /></BrowserRouter>);
    fireEvent.change(screen.getByRole("textbox", { name: "Monto" }), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("¿Descartar los cambios?");
    expect(cerrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(screen.getByRole("textbox", { name: "Monto" })).toHaveValue("25");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(cerrar).toHaveBeenCalledWith(false);
    expect(registrar).not.toHaveBeenCalled();
  });

  it("X protege captura; cerrar un formulario intacto no pide confirmación", () => {
    const cerrar = vi.fn();
    render(<BrowserRouter><RegistrarAnticipoDialog open onOpenChange={cerrar} /></BrowserRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(cerrar).toHaveBeenCalledWith(false);
    cerrar.mockClear();
    fireEvent.change(screen.getByRole("textbox", { name: "Monto" }), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(cerrar).not.toHaveBeenCalled();
  });
});
