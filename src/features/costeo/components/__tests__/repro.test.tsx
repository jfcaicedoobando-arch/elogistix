import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { EntidadesFields } from "@/features/costeo/components/TarifaFormFields";
import { buildInitialForm } from "@/features/costeo/components/TarifaForm.helpers";

vi.mock("@/features/catalogos/hooks", () => ({
  useAdminNavieras: () => ({ agregarNaviera: { mutate: vi.fn(), isPending: false } }),
}));

if (!Element.prototype.hasPointerCapture) {
  // @ts-expect-error polyfill jsdom
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  // @ts-expect-error polyfill jsdom
  Element.prototype.releasePointerCapture = () => {};
}

function Wrapper() {
  const [form, setForm] = useState(buildInitialForm());
  return (
    <EntidadesFields
      form={form}
      setForm={setForm}
      agentes={[{ id: "a1", nombre: "Agente 1", activo: true }]}
      navieras={[{ id: "n1", name: "Maersk Line" }, { id: "n2", name: "MSC" }]}
    />
  );
}

describe("repro naviera select", () => {
  it("mantiene la selección", async () => {
    render(<Wrapper />);
    fireEvent.pointerDown(screen.getByLabelText("Naviera *"), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByLabelText("Naviera *"));
    const item = await screen.findByText("Maersk Line");
    fireEvent.pointerDown(item);
    fireEvent.click(item);
    expect(await screen.findByText("Maersk Line")).toBeInTheDocument();
  });
});
