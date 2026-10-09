/** Guardar una ruta anidada nunca debe enviar la tarifa que la contiene. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { TarifaInput } from "@/features/costeo/services/tarifas";

const mocks = vi.hoisted(() => ({ crearRuta: vi.fn(), guardarTarifa: vi.fn() }));
vi.mock("@/features/costeo/hooks/useCosteoAgentes", () => ({
  useCosteoAgentes: () => ({ data: [{ id: "agente", nombre: "Agente" }] }),
}));
vi.mock("@/features/costeo/hooks/useCosteoRutas", () => ({
  useCosteoRutas: () => ({ data: [
    { id: "ruta-existente", activa: true, puerto_origen_nombre: "Origen anterior", puerto_destino_nombre: "Destino anterior" },
    { id: "ruta-nueva", activa: true, puerto_origen_nombre: "Puerto 1", puerto_destino_nombre: "Puerto 2" },
  ] }),
  useCosteoRutaMutations: () => ({ crear: { mutateAsync: mocks.crearRuta, isPending: false } }),
}));
vi.mock("@/features/catalogos/hooks", () => ({
  useNavieras: () => ({ data: [{ id: "naviera", name: "Naviera" }] }),
  useTiposContenedor: () => ({ data: [{ id: "tipo", nombre: "40 HC" }] }),
}));
vi.mock("@/features/costeo/hooks/useCosteoTarifas", () => ({
  useCosteoTarifaMutations: () => ({
    crear: { isPending: false }, crearMultiples: { isPending: false }, actualizar: { isPending: false },
  }),
}));
vi.mock("@/features/costeo/hooks/useTarifaSubmit", () => ({
  useTarifaSubmit: () => mocks.guardarTarifa,
}));
vi.mock("@/features/catalogos", () => ({
  PortIdSelect: ({ id, value, onChange }: { id: string; value: string; onChange: (id: string) => void }) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Seleccionar</option><option value="p1">Puerto 1</option><option value="p2">Puerto 2</option>
    </select>
  ),
}));
vi.mock("../NavieraQuickCreate", () => ({ NavieraQuickCreate: () => null }));
vi.mock("../AgenteProvisionalDialog", () => ({ AgenteProvisionalDialog: () => null }));
vi.mock("../TarifaRecargosEditor", () => ({ TarifaRecargosEditor: () => null }));
vi.mock("../TarifaPricingFields", () => ({ TarifaPricingFields: () => null }));

import { TarifaForm } from "../TarifaForm";

const initial: Partial<TarifaInput> = {
  agente_id: "agente", naviera_id: "naviera", ruta_id: "ruta-existente",
  tipo_contenedor_id: "tipo", flete_base: 100, vigente_desde: "2026-10-01", vigente_hasta: "2026-10-31",
};
function montar(tarifaId?: string) {
  const onOpenChange = vi.fn();
  render(<TarifaForm open onOpenChange={onOpenChange} initial={initial} tarifaId={tarifaId} />);
  fireEvent.click(screen.getByRole("button", { name: /Nueva ruta/ }));
  const dialogo = screen.getByRole("dialog", { name: "Nueva ruta marítima" });
  fireEvent.change(document.getElementById("ruta-origen")!, { target: { value: "p1" } });
  fireEvent.change(document.getElementById("ruta-destino")!, { target: { value: "p2" } });
  return { dialogo, onOpenChange };
}
describe("RutaQuickCreate dentro de TarifaForm real", () => {
  beforeEach(() => {
    mocks.crearRuta.mockReset().mockResolvedValue({ id: "ruta-nueva" });
    mocks.guardarTarifa.mockReset();
  });

  it.each([undefined, "tarifa-existente"])("crea la ruta sin enviar ni cerrar la tarifa (%s)", async (tarifaId) => {
    const { dialogo, onOpenChange } = montar(tarifaId);
    fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nueva ruta marítima" })).toBeNull());
    expect(mocks.crearRuta).toHaveBeenCalledWith({ puerto_origen_id: "p1", puerto_destino_id: "p2" });
    expect(mocks.guardarTarifa).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    const boton = screen.getByRole("button", { name: tarifaId ? "Guardar cambios" : "Guardar 2 tarifas" });
    expect(boton).toBeEnabled();
    fireEvent.click(boton);
    expect(mocks.guardarTarifa).toHaveBeenCalledTimes(1);
  });

  it("un error de ruta mantiene ambos diálogos sin enviar la tarifa", async () => {
    mocks.crearRuta.mockRejectedValue(new Error("Error de prueba"));
    const { dialogo, onOpenChange } = montar();
    await act(async () => { fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar" })); });
    expect(screen.getByRole("dialog", { name: "Nueva ruta marítima" })).toBeInTheDocument();
    expect(mocks.crearRuta).toHaveBeenCalledTimes(1);
    expect(mocks.guardarTarifa).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("cancelar la ruta no crea datos ni cierra la tarifa", () => {
    const { dialogo, onOpenChange } = montar();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog", { name: "Nueva ruta marítima" })).toBeNull();
    expect(mocks.crearRuta).not.toHaveBeenCalled();
    expect(mocks.guardarTarifa).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
