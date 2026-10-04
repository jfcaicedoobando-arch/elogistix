import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { proformaFixture } from "./fixtures/proforma";

const { convertir } = vi.hoisted(() => ({ convertir: vi.fn() }));
vi.mock("@/features/proformas/hooks", () => ({
  useConvertirProformaDirecto: () => ({ convertir, isPending: false }),
}));
import { ProformasFusionToolbar } from "../ProformasFusionToolbar";

function selection(overrides: Partial<ComponentProps<typeof ProformasFusionToolbar>["selection"]> = {}) {
  return {
    selectedProformas: [proformaFixture({ id: "p1" }), proformaFixture({ id: "p2" })],
    fusionInfo: { sameCliente: true, sameTipo: true, sameDiasCredito: true, clienteNombre: "Cliente sintético", organizationId: "org1", diasCredito: null },
    clearSelected: vi.fn(),
    ...overrides,
  };
}
beforeEach(() => { convertir.mockReset(); });

describe("Conversión de la selección de proformas", () => {
  it("conserva IDs, organización y plazo heredado y limpia sólo tras confirmar éxito", () => {
    const current = selection();
    render(<ProformasFusionToolbar selection={current} />);
    fireEvent.click(screen.getByRole("button", { name: "Fusionar 2 en una factura" }));
    expect(convertir.mock.calls[0][0]).toEqual({ proformaIds: ["p1", "p2"], organizationId: "org1", diasCredito: null });
    expect(current.clearSelected).not.toHaveBeenCalled();
    convertir.mock.calls[0][1].onSuccess();
    expect(current.clearSelected).toHaveBeenCalledTimes(1);
  });

  it("mantiene el bloqueo por clientes distintos sin intentar convertir", () => {
    const current = selection();
    render(<ProformasFusionToolbar selection={selection({ fusionInfo: { ...current.fusionInfo, sameCliente: false } })} />);
    expect(screen.getByText("Sólo puedes fusionar proformas del mismo cliente.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Fusionar 2 en una factura" });
    expect(button).toBeDisabled(); fireEvent.click(button);
    expect(convertir).not.toHaveBeenCalled();
  });

  it("sin organización mantiene el no-op y Limpiar sigue disponible", () => {
    const current = selection(); current.fusionInfo.organizationId = "";
    render(<ProformasFusionToolbar selection={current} />);
    fireEvent.click(screen.getByRole("button", { name: "Fusionar 2 en una factura" }));
    expect(convertir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(current.clearSelected).toHaveBeenCalledTimes(1);
  });
});
