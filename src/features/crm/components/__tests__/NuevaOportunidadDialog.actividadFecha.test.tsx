/**
 * Auditoría CRM de fechas: la tarea automática de seguimiento al crear una
 * oportunidad ya no usa "mañana 9:00" del reloj local; usa la regla central
 * `actividadDefaultFechaMx` (calendario CDMX, siguiente día hábil).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import { EMPTY_OPORTUNIDAD } from "@/features/crm/domain/oportunidadFormState";
import { actividadDefaultFechaMx } from "@/features/crm/domain/actividadDefaultFecha";

const crearOportunidad = vi.fn(async () => ({ id: "op-1" }));
const crearActividad = vi.fn(async () => ({ id: "act-1" }));

vi.mock("@/features/crm/hooks", () => ({
  useCrearOportunidad: () => ({ mutateAsync: crearOportunidad, isPending: false }),
  useActualizarOportunidad: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCrearActividad: () => ({ mutateAsync: crearActividad, isPending: false }),
  useEtapasPipeline: () => ({
    data: [{ id: "e-ab", nombre: "Prospección", probabilidad_default: 20, tipo: "abierta" }],
  }),
  useOportunidadForm: () => ({
    form: {
      ...EMPTY_OPORTUNIDAD,
      origen_tipo: "cliente",
      cliente_id: "c-1",
      etapa_id: "e-ab",
      nombre: "Oportunidad Acme",
      vendedor_id: "u-1",
      vendedor_email: "kam@acme.com",
    },
    setForm: vi.fn(),
    set: vi.fn(),
    isDirty: false,
    markClean: vi.fn(),
  }),
}));
vi.mock("@/features/cliente/hooks", () => ({ useClientesForSelect: () => ({ data: [] }) }));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "kam@acme.com" } }),
}));
vi.mock("@/features/crm/components/nuevaOportunidad/OportunidadFormFields", () => ({
  default: () => <div />,
}));

async function crearYObtenerFecha(): Promise<string> {
  render(<NuevaOportunidadDialog open onOpenChange={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /Crear oportunidad/i }));
  await waitFor(() => expect(crearActividad).toHaveBeenCalled());
  return crearActividad.mock.calls[0][0].fecha_programada as string;
}

describe("NuevaOportunidadDialog — fecha de la tarea automática", () => {
  beforeEach(() => {
    crearOportunidad.mockClear();
    crearActividad.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it("viernes por la tarde: programa el siguiente día hábil (lunes), no sábado", async () => {
    // Viernes 19/06/2026 18:00 CDMX (23:00Z).
    vi.setSystemTime(new Date("2026-06-19T23:00:00Z"));
    const iso = await crearYObtenerFecha();
    expect(actividadDefaultFechaMx()).toBe("2026-06-22T09:00");
    expect(iso).toBe(new Date("2026-06-22T09:00").toISOString());
    expect(new Date(iso).getDay()).not.toBe(6);
    expect(new Date(iso).getDay()).not.toBe(0);
  });

  it("sábado: nunca programa fin de semana", async () => {
    vi.setSystemTime(new Date("2026-06-20T15:00:00Z"));
    const iso = await crearYObtenerFecha();
    expect(iso).toBe(new Date("2026-06-22T09:00").toISOString());
  });

  it("no depende del reloj local del navegador: siempre deriva de la regla CDMX", async () => {
    // 15/06/2026 05:00Z = lunes 23:00 del domingo 14 en CDMX → siguiente hábil.
    vi.setSystemTime(new Date("2026-06-15T05:00:00Z"));
    const iso = await crearYObtenerFecha();
    expect(iso).toBe(new Date(actividadDefaultFechaMx()).toISOString());
  });
});
