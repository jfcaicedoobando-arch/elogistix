import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { crearAgenteProvisional } from "@/features/proveedor/services/altaProvisional";
import { AgenteProvisionalDialog } from "../AgenteProvisionalDialog";

vi.mock("@/features/proveedor/services/altaProvisional", () => ({ crearAgenteProvisional: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe("AgenteProvisionalDialog", () => {
  it("permite cancelar y reabrir conservando la captura sin crear un agente", () => {
    render(<AgenteProvisionalDialog onCreado={vi.fn()} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "Agente provisional" }));
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nombre *"), { target: { value: "Agente borrador" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agente provisional" }));
    expect(screen.getByLabelText("Nombre *")).toHaveValue("Agente borrador");
    expect(crearAgenteProvisional).not.toHaveBeenCalled();
  });

  it("envía una sola creación pendiente y limpia el formulario después del éxito", async () => {
    let resolve!: (id: string) => void;
    vi.mocked(crearAgenteProvisional).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const onCreado = vi.fn();
    render(<AgenteProvisionalDialog onCreado={onCreado} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "Agente provisional" }));
    fireEvent.change(screen.getByLabelText("Nombre *"), { target: { value: "Agente nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(crearAgenteProvisional).toHaveBeenCalledTimes(1);
    expect(onCreado).not.toHaveBeenCalled();
    await act(async () => resolve("ag-1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onCreado).toHaveBeenCalledExactlyOnceWith("ag-1");
    fireEvent.click(screen.getByRole("button", { name: "Agente provisional" }));
    expect(screen.getByLabelText("Nombre *")).toHaveValue("");
    expect(screen.getByLabelText("País (código)")).toHaveValue("CN");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});
