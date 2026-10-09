import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DemorasTramoInput } from "../../types/navieraCondicion";

const state = vi.hoisted(() => ({ tramos: [] as DemorasTramoInput[], mutateAsync: vi.fn() }));
const tipos = [{ id: "40", code: "40HC", name: "40 pies" }];
vi.mock("@/features/costeo/hooks/useNavieraCondiciones", () => ({
  useTiposContenedorDemoras: () => ({ data: tipos }),
  useDemorasTramos: () => ({ data: state.tramos }),
  useReemplazarTramos: () => ({ mutateAsync: state.mutateAsync, isPending: false }),
}));
import { DemorasTarifaEditor } from "../DemorasTarifaEditor";

const tramo = (dia: number, moneda: string): DemorasTramoInput => ({
  tipo_contenedor_id: "40", desde_dia: dia, hasta_dia: dia, monto_por_dia: 1, moneda,
});
beforeEach(() => { vi.clearAllMocks(); state.mutateAsync.mockResolvedValue(undefined); });

describe("audit147 · moneda del tabulador", () => {
  it("una mezcla guardada se muestra íntegra y bloquea guardar con explicación", async () => {
    state.tramos = [tramo(1, "USD"), tramo(2, "MXN")];
    render(<DemorasTarifaEditor navieraCondicionId="cond" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No hay conversión automática");
    expect(screen.getByRole("button", { name: /Guardar tabulador/ })).toBeDisabled();
    expect(screen.getByLabelText("Monto por día del tramo 2")).toBeInTheDocument();
    expect(state.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Quitar tramo 2" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: /Guardar tabulador/ })).toBeEnabled();
  });
  it.each(["USD", "MXN", "EUR"])("permite todos los tramos en %s", async (moneda) => {
    state.tramos = [tramo(1, moneda), tramo(2, moneda), tramo(3, moneda)];
    render(<DemorasTarifaEditor navieraCondicionId="cond" />);
    await screen.findByLabelText("Monto por día del tramo 3");
    fireEvent.click(screen.getByRole("button", { name: /Guardar tabulador/ }));
    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledWith({
      navieraCondicionId: "cond", tipoContenedorId: "40", tramos: state.tramos,
    }));
  });
});
