/**
 * v13.823.51 — alta express de oportunidad:
 *  - la lista de prospectos usa la definición canónica del embudo (sin
 *    `Convertido`, que ya salió del embudo),
 *  - se conserva el vendedor dueño del prospecto (antes se reasignaba al
 *    usuario que capturaba).
 */
import type React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import QuickCreateOportunidadDialog from "@/features/crm/components/quickCreate/QuickCreateOportunidadDialog";
import { LEAD_ESTADOS_ETAPA_PROSPECTO } from "@/features/crm/domain/leads/etapas";

const mutateAsync = vi.fn(async (_input: Record<string, unknown>) => ({ id: "op-1" }));
const estadosRecibidos: (string[] | undefined)[] = [];

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-actual", email: "actual@x.com" } }),
}));
vi.mock("@/features/crm/hooks", () => ({
  useCrearOportunidad: () => ({ mutateAsync, isPending: false }),
  useEtapasPipeline: () => ({ data: [{ id: "e1", orden: 1, probabilidad_default: 20 }] }),
}));
// Radix Select no es operable en jsdom: se sustituye por un <select> nativo.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select data-testid="origen" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));
vi.mock("@/features/cliente/hooks", () => ({ useClientesForSelect: () => ({ data: [] }) }));
vi.mock("@/features/crm/components/comboboxes/EntidadComboboxCrm", () => ({
  LeadComboboxCrm: ({
    estadoIn,
    onChange,
  }: {
    estadoIn?: string[];
    onChange: (id: string, label: string, meta?: { vendedor_id: string | null; vendedor_email: string }) => void;
  }) => {
    estadosRecibidos.push(estadoIn);
    return (
      <button
        type="button"
        onClick={() => onChange("lead-1", "ACME", { vendedor_id: "u-dueno", vendedor_email: "dueno@x.com" })}
      >
        elegir-prospecto
      </button>
    );
  },
}));

describe("QuickCreateOportunidadDialog", () => {
  it("ofrece sólo prospectos activos (sin Convertido) y conserva su vendedor", async () => {
    mutateAsync.mockClear();
    estadosRecibidos.length = 0;
    render(
      <QuickCreateOportunidadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: "Op nueva" } });
    // Cambiar el origen a prospecto monta el combobox.
    fireEvent.change(screen.getAllByTestId("origen")[0], { target: { value: "prospecto" } });
    fireEvent.click(screen.getByRole("button", { name: "elegir-prospecto" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const payload = mutateAsync.mock.calls[0]![0];
    expect(payload.lead_id).toBe("lead-1");
    expect(payload.vendedor_id).toBe("u-dueno");
    expect(payload.vendedor_email).toBe("dueno@x.com");

    const estados = estadosRecibidos.find(Boolean);
    expect(estados).toEqual([...LEAD_ESTADOS_ETAPA_PROSPECTO]);
    expect(estados).not.toContain("Convertido");
  });
});
