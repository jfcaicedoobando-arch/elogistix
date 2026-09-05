import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntidadesFields } from "@/features/costeo/components/TarifaFormFields";
import { buildInitialForm } from "@/features/costeo/components/TarifaForm.helpers";
import { useState } from "react";

vi.mock("@/features/catalogos/hooks", () => ({
  useAdminNavieras: () => ({ agregarNaviera: { mutate: vi.fn(), isPending: false } }),
}));

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
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Naviera *"));
    await user.click(await screen.findByText("Maersk Line"));
    expect(screen.getByText("Maersk Line")).toBeInTheDocument();
  });
});
