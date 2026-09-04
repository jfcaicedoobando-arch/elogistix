/**
 * Regresión: al EDITAR una oportunidad el origen es de sólo lectura y debe
 * mostrar el nombre real. `crm_oportunidades` no guarda el nombre del lead,
 * así que se hidrata desde `crm_leads` (sin tocar el formulario, para que
 * guardar otros campos conserve `lead_id`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OportunidadFormFields from "@/features/crm/components/nuevaOportunidad/OportunidadFormFields";
import { EMPTY_OPORTUNIDAD } from "@/features/crm/domain/oportunidadFormState";
import type { OportunidadFormState } from "@/features/crm/hooks";

vi.mock("@/features/crm/components/VendedorSelect", () => ({ default: () => null }));

const maybeSingle = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => ({ maybeSingle }) }),
      }),
    }),
  },
}));

const ETAPAS = [{ id: "e-ab", nombre: "Prospección", probabilidad_default: 20, tipo: "abierta" }];

function renderCampos(form: OportunidadFormState) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <OportunidadFormFields
        form={form}
        setForm={vi.fn()}
        set={vi.fn()}
        etapas={ETAPAS}
        clientes={[]}
        isEdit
        autoActividad={false}
        setAutoActividad={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("OportunidadFormFields · origen en edición", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
  });

  it("hidrata el nombre del prospecto cuando la fila sólo trae lead_id", async () => {
    maybeSingle.mockResolvedValue({ data: { empresa: "QA Smoke KAM", contacto: null }, error: null });
    renderCampos({
      ...EMPTY_OPORTUNIDAD,
      nombre: "QA Smoke Oportunidad KAM 2026-09-04",
      origen_tipo: "prospecto",
      lead_id: "lead-1",
      lead_nombre: "",
      etapa_id: "e-ab",
    });

    expect(screen.getByText("Prospecto")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("QA Smoke KAM")).toBeInTheDocument());
    expect(screen.queryByText(/Selecciona un prospecto/)).toBeNull();
  });

  it("muestra el nombre del cliente sin consultar leads", async () => {
    renderCampos({
      ...EMPTY_OPORTUNIDAD,
      nombre: "Oportunidad Cliente",
      origen_tipo: "cliente",
      cliente_id: "cli-1",
      cliente_nombre: "Aceros del Norte",
      etapa_id: "e-ab",
    });

    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("Aceros del Norte")).toBeInTheDocument();
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});
