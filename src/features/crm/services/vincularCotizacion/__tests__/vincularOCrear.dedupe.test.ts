/**
 * Fase 1 CRM — datos confiables: la vinculación cotización→CRM debe
 * reutilizar el lead existente con el mismo email en lugar de duplicarlo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const createLead = vi.fn();
const crearOportunidad = vi.fn();
const findLeadIdByEmail = vi.fn();
const setCotizacionOportunidad = vi.fn();

vi.mock("@/features/crm/services/leads/mutations", () => ({
  createLead: (...a: unknown[]) => createLead(...a),
}));
vi.mock("@/features/crm/services/oportunidades", () => ({
  crearOportunidad: (...a: unknown[]) => crearOportunidad(...a),
}));
vi.mock("../helpers", () => ({
  buildOpNombre: (empresa: string, folio?: string) => `${empresa} — ${folio ?? ""}`,
  resolveEtapaCotizandoId: () => Promise.resolve({ id: "etapa-1", probabilidad: 30 }),
  setCotizacionOportunidad: (...a: unknown[]) => setCotizacionOportunidad(...a),
  findLeadIdByEmail: (...a: unknown[]) => findLeadIdByEmail(...a),
}));

const { vincularOCrearOportunidadParaCotizacion } = await import("../vincularOCrear");

const baseInput = {
  cotizacionId: "cot-1",
  cotizacionFolio: "COT-2026-0001",
  modoTransporte: "Marítimo",
  prospecto: {
    empresa: "Nova Trading",
    contacto: "Sergio Mendoza",
    email: "info@novatradepartners.com",
    telefono: "+50689804221",
  },
  user: { id: "u1", email: "v@x.com" },
};

describe("vincularOCrearOportunidadParaCotizacion — dedupe por email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    crearOportunidad.mockResolvedValue({ id: "op-1" });
    createLead.mockResolvedValue({ id: "lead-nuevo" });
    setCotizacionOportunidad.mockResolvedValue(undefined);
  });

  it("reutiliza el lead existente y no crea duplicado", async () => {
    findLeadIdByEmail.mockResolvedValue("lead-existente");
    const r = await vincularOCrearOportunidadParaCotizacion(baseInput);
    expect(createLead).not.toHaveBeenCalled();
    expect(r.leadId).toBe("lead-existente");
    expect(crearOportunidad).toHaveBeenCalledWith(
      expect.objectContaining({ lead_id: "lead-existente", cliente_nombre: "Nova Trading" }),
      baseInput.user,
    );
  });

  it("crea el lead cuando no hay coincidencia de email", async () => {
    findLeadIdByEmail.mockResolvedValue(null);
    const r = await vincularOCrearOportunidadParaCotizacion(baseInput);
    expect(createLead).toHaveBeenCalledTimes(1);
    expect(r.leadId).toBe("lead-nuevo");
  });
});
