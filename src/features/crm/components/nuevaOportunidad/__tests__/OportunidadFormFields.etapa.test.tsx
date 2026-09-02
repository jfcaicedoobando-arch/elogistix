/**
 * v13.823.52 — la etapa NUNCA es editable en el formulario de oportunidad:
 * al crear se usa la primera etapa abierta (nunca Ganada/Perdida) y al mover
 * se pasa por la acción canónica del pipeline.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import OportunidadFormFields from "@/features/crm/components/nuevaOportunidad/OportunidadFormFields";
import { buildEmptyForNueva } from "@/features/crm/domain/oportunidadFormHelpers";
import type { OportunidadFormState } from "@/features/crm/hooks";

vi.mock("@/features/crm/components/VendedorSelect", () => ({ default: () => null }));
vi.mock("@/features/crm/components/nuevaOportunidad/SelectorOrigenOportunidad", () => ({
  default: () => null,
}));

const ETAPAS = [
  { id: "e-gan", nombre: "Ganada", probabilidad_default: 100, tipo: "ganada" },
  { id: "e-ab", nombre: "Prospección", probabilidad_default: 20, tipo: "abierta" },
  { id: "e-per", nombre: "Perdida", probabilidad_default: 0, tipo: "perdida" },
];

function renderCampos(form: OportunidadFormState) {
  render(
    <OportunidadFormFields
      form={form}
      setForm={vi.fn()}
      set={vi.fn()}
      etapas={ETAPAS}
      clientes={[]}
      isEdit={false}
      autoActividad={false}
      setAutoActividad={vi.fn()}
    />,
  );
}

describe("OportunidadFormFields · etapa", () => {
  it("al crear muestra la primera etapa abierta en sólo lectura", () => {
    const form = buildEmptyForNueva(ETAPAS, null);
    expect(form.etapa_id).toBe("e-ab");

    renderCampos(form);
    const campo = screen.getByLabelText(/Etapa/i) as HTMLInputElement;
    expect(campo.tagName).toBe("INPUT");
    expect(campo).toHaveAttribute("readonly");
    expect(campo.value).toBe("Prospección");
    // No hay forma de elegir Ganada/Perdida desde el formulario.
    expect(screen.queryByText("Ganada")).toBeNull();
    expect(screen.queryByText("Perdida")).toBeNull();
  });
});
