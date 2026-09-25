/** P2-A5: el modal no se cierra mientras guarda; sí al terminar con éxito. */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const estado = { pending: false };
let onSuccessCapturado: (() => void) | undefined;

vi.mock("@/features/costeo/hooks/useCosteoAgentes", () => ({ useCosteoAgentes: () => ({ data: [] }) }));
vi.mock("@/features/costeo/hooks/useCosteoRutas", () => ({ useCosteoRutas: () => ({ data: [] }) }));
vi.mock("@/features/catalogos/hooks", () => ({
  useNavieras: () => ({ data: [] }), useTiposContenedor: () => ({ data: [] }),
}));
vi.mock("@/features/costeo/hooks/useCosteoTarifas", () => ({
  useCosteoTarifaMutations: () => ({
    crear: { isPending: estado.pending }, crearMultiples: { isPending: false }, actualizar: { isPending: false },
  }),
}));
vi.mock("@/features/costeo/hooks/useTarifaSubmit", () => ({
  useTarifaSubmit: (a: { onSuccess: () => void }) => { onSuccessCapturado = a.onSuccess; return vi.fn(); },
}));
vi.mock("../TarifaFormFields", () => ({
  EntidadesFields: () => null, RutaTipoFields: () => null, NumerosFields: () => null, VigenciaFields: () => null,
}));

import { TarifaForm } from "../TarifaForm";

describe("TarifaForm — busy", () => {
  it("Escape no cierra mientras la mutación está pendiente", () => {
    estado.pending = true;
    const onOpenChange = vi.fn();
    render(<TarifaForm open onOpenChange={onOpenChange} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("al terminar con éxito se cierra", () => {
    estado.pending = false;
    const onOpenChange = vi.fn();
    render(<TarifaForm open onOpenChange={onOpenChange} />);
    onSuccessCapturado?.();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
