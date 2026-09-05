/**
 * Regresión UX: al pulsar "Más campos →" en las altas express, lo capturado
 * debía perderse. Ahora el alta express entrega un borrador mínimo y el
 * formulario completo abre con esos valores.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuickCreateLeadDialog from "@/features/crm/components/quickCreate/QuickCreateLeadDialog";
import QuickCreateActividadDialog from "@/features/crm/components/quickCreate/QuickCreateActividadDialog";
import NuevoLeadDialog from "@/features/crm/components/NuevoLeadDialog";
import NuevaActividadDialog from "@/features/crm/components/NuevaActividadDialog";

const crearLead = vi.fn(async () => ({ id: "lead-1" }));
const crearActividad = vi.fn(async () => ({ id: "act-1" }));

vi.mock("@/features/crm/hooks", () => ({
  ACTIVIDAD_TIPOS: ["tarea", "llamada"] as const,
  LEAD_ESTADOS_MANUALES: ["Nuevo"] as const,
  LEAD_FUENTES: ["Otro"] as const,
  useCrearLead: () => ({ mutateAsync: crearLead, isPending: false }),
  useCrearActividad: () => ({ mutateAsync: crearActividad, isPending: false }),
  useOportunidades: () => ({ data: { data: [{ id: "op-1", nombre: "Op Acme" }] } }),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "kam@librecarga.com" } }),
}));
vi.mock("@/features/crm/components/VendedorSelect", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/AvisoLeadDuplicado", () => ({ AvisoLeadDuplicado: () => <div /> }));
vi.mock("@/features/crm/components/comboboxes/EntidadComboboxCrm", () => ({
  LeadComboboxCrm: () => <div />,
  OportunidadComboboxCrm: () => <div />,
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

beforeEach(() => {
  crearLead.mockClear();
  crearActividad.mockClear();
});

describe("Alta express de lead → Más campos", () => {
  it("entrega empresa y contacto capturados", () => {
    const onMore = vi.fn();
    render(<QuickCreateLeadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={onMore} />);
    fireEvent.change(screen.getByLabelText(/Empresa/i), { target: { value: " Acme Logistics " } });
    fireEvent.change(screen.getByLabelText(/Correo o teléfono/i), { target: { value: "ana@acme.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Más campos/i }));
    expect(onMore).toHaveBeenCalledWith({ empresa: "Acme Logistics", contacto: "ana@acme.com" });
  });

  it("el formulario completo abre con el correo en su campo canónico", () => {
    render(
      <NuevoLeadDialog
        open
        onOpenChange={vi.fn()}
        draftInicial={{ empresa: "Acme Logistics", contacto: "ana@acme.com" }}
      />,
    );
    expect((screen.getByLabelText(/Empresa/i) as HTMLInputElement).value).toBe("Acme Logistics");
    expect((screen.getByLabelText(/Email|Correo/i) as HTMLInputElement).value).toBe("ana@acme.com");
  });

  it("un teléfono capturado va al campo teléfono, no al correo", () => {
    render(
      <NuevoLeadDialog
        open
        onOpenChange={vi.fn()}
        draftInicial={{ empresa: "Acme", contacto: "5555555555" }}
      />,
    );
    expect((screen.getByLabelText(/Teléfono/i) as HTMLInputElement).value).toBe("5555555555");
    expect((screen.getByLabelText(/Email|Correo/i) as HTMLInputElement).value).toBe("");
  });
});

describe("Alta express de actividad → Más campos", () => {
  it("entrega asunto, entidad, tipo tarea y fecha", () => {
    const onMore = vi.fn();
    render(<QuickCreateActividadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={onMore} />);
    fireEvent.change(screen.getByLabelText(/Asunto/i), { target: { value: " Llamar a Acme " } });
    fireEvent.click(screen.getByRole("button", { name: /Más campos/i }));
    expect(onMore).toHaveBeenCalledTimes(1);
    const draft = onMore.mock.calls[0]![0] as { asunto: string; tipo: string; fecha: string };
    expect(draft.asunto).toBe("Llamar a Acme");
    expect(draft.tipo).toBe("tarea");
    expect(draft.fecha).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it("el formulario completo abre con asunto, fecha y oportunidad del borrador", () => {
    render(
      <NuevaActividadDialog
        open
        onOpenChange={vi.fn()}
        asuntoInicial="Llamar a Acme"
        fechaInicial="2026-06-15T17:00"
        entidadIdInicial="op-1"
      />,
    );
    expect((screen.getByLabelText(/Asunto/i) as HTMLInputElement).value).toBe("Llamar a Acme");
    expect(screen.getByDisplayValue("2026-06-15T17:00")).toBeTruthy();
  });

  it("sin borrador el formulario completo sigue abriendo vacío", () => {
    render(<NuevaActividadDialog open onOpenChange={vi.fn()} />);
    expect((screen.getByLabelText(/Asunto/i) as HTMLInputElement).value).toBe("");
  });
});
