import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuickAddFullDialogs from "../QuickAddFullDialogs";

const renderOportunidad = vi.hoisted(() => vi.fn());

vi.mock("@/features/crm/components/NuevaOportunidadDialog", () => ({
  default: (props: unknown) => {
    renderOportunidad(props);
    return null;
  },
}));
vi.mock("@/features/crm/components/NuevoLeadDialog", () => ({
  default: () => null,
}));
vi.mock("@/features/crm/components/NuevaActividadDialog", () => ({
  default: () => null,
}));
vi.mock("@/features/crm/components/ImportarLeadsCsvDialog", () => ({
  default: () => null,
}));
vi.mock("@/features/crm/hooks/useVolverAgendaActividad", () => ({
  useVolverAgendaActividad: () => vi.fn(),
}));

describe("QuickAddFullDialogs · borrador de oportunidad", () => {
  beforeEach(() => renderOportunidad.mockClear());

  it.each(["", "0", "1500", "1500.25", "0.01"])(
    "pasa el importe '%s' y todos los campos precapturados",
    (valorEstimado) => {
      const empresa = { id: "empresa-1", nombre: "Acme" };
      const origen = {
        tipo: "prospecto" as const,
        id: "lead-1",
        nombre: "Acme",
        vendedorId: "u-dueno",
        vendedorEmail: "dueno@example.test",
      };

      render(
        <MemoryRouter>
          <QuickAddFullDialogs
            leadOpen={false}
            onLeadOpenChange={vi.fn()}
            leadDraft={null}
            opOpen
            onOpOpenChange={vi.fn()}
            opDraft={{
              nombre: "Importación China Q1",
              empresa,
              origen,
              etapaId: "e-neg",
              valorEstimado,
            }}
            actOpen={false}
            onActOpenChange={vi.fn()}
            actDraft={null}
            importOpen={false}
            onImportOpenChange={vi.fn()}
          />
        </MemoryRouter>,
      );

      expect(renderOportunidad).toHaveBeenLastCalledWith(
        expect.objectContaining({
          open: true,
          nombreInicial: "Importación China Q1",
          empresaInicial: empresa,
          origenInicial: origen,
          etapaInicialId: "e-neg",
          valorEstimadoInicial: valorEstimado,
        }),
      );
    },
  );
});
