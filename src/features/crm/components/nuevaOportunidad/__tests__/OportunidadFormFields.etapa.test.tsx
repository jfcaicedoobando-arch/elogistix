/**
 * v13.823.52 — la etapa NUNCA es editable en el formulario de oportunidad:
 * al crear se usa la primera etapa abierta (nunca Ganada/Perdida) y al mover
 * se pasa por la acción canónica del pipeline.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OportunidadFormFields from "@/features/crm/components/nuevaOportunidad/OportunidadFormFields";
import { buildEmptyForNueva } from "@/features/crm/domain/oportunidadFormHelpers";
import type { OportunidadFormState } from "@/features/crm/hooks";

vi.mock("@/features/crm/components/VendedorSelect", () => ({ default: () => null }));
vi.mock("@/features/crm/components/nuevaOportunidad/SelectorOrigenOportunidad", () => ({
  default: () => null,
}));

// v13.823.53 — Ganada aparece PRIMERO a propósito: la etapa inicial debe ser
// la primera ABIERTA, nunca `etapas[0]`.
const ETAPAS = [
  { id: "e-gan", nombre: "Ganada", probabilidad_default: 100, tipo: "ganada" },
  { id: "e-ab", nombre: "Prospección", probabilidad_default: 20, tipo: "abierta" },
  { id: "e-per", nombre: "Perdida", probabilidad_default: 0, tipo: "perdida" },
];
const ETAPAS_SOLO_TERMINALES = [ETAPAS[0], ETAPAS[2]];

function renderCampos(form: OportunidadFormState, etapas = ETAPAS) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
    <OportunidadFormFields
      form={form}
      setForm={vi.fn()}
      set={vi.fn()}
      etapas={etapas}
      clientes={[]}
      isEdit={false}
      autoActividad={false}
      setAutoActividad={vi.fn()}
    />
    </QueryClientProvider>,
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

  it("sin etapas abiertas no fija etapa y muestra el mensaje de configuración", () => {
    const form = buildEmptyForNueva(ETAPAS_SOLO_TERMINALES, null);
    expect(form.etapa_id).toBe("");

    renderCampos(form, ETAPAS_SOLO_TERMINALES);
    expect(
      screen.getByText("Configura al menos una etapa abierta en el pipeline"),
    ).toBeInTheDocument();
  });
});
