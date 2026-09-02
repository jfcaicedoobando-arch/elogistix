/**
 * v13.823.31 — Ficha de lead:
 *  - el formulario deriva del dato persistido (correo nunca "desaparece"),
 *  - "Calificar como prospecto" nunca falla en silencio (gate con faltantes).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const calificarMutate = vi.fn();
const actualizarMutateAsync = vi.fn().mockResolvedValue(undefined);
let calificarPending = false;

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/features/crm/hooks", () => ({
  useActualizarLead: () => ({ mutateAsync: actualizarMutateAsync, isPending: false }),
  useEliminarLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTomarLead: () => ({ mutate: vi.fn(), isPending: false }),
  useCalificarProspecto: () => ({ mutate: calificarMutate, get isPending() { return calificarPending; } }),
}));

import { useLeadEditForm } from "../useLeadEditForm";
import { useLeadDetalleAcciones } from "../useLeadDetalleAcciones";

const leadBase = {
  id: "a3eaecf5-1b3d-417a-93b3-7930969b352a",
  empresa: "QA-CODEX Comercial Demo",
  contacto: null,
  email: "qa-codex-comercial@example.com",
  telefono: null,
  ciudad: null,
  pais: null,
  fuente: "Otro" as const,
  estado: "Nuevo" as const,
  score: null,
  interes_modo: null,
  notas: null,
};

const icpCompleto = {
  sector: "Retail",
  mercancia: "Textil",
  rutas: "Shanghai–Manzanillo",
  volumen: "4 TEU",
  frecuencia: "Mensual",
  dolor_explicito: "Demoras",
  proveedor_actual: "Otro forwarder",
};

describe("useLeadEditForm · gate de prospecto", () => {
  it("inicializa el correo desde la fila persistida", () => {
    const { result } = renderHook(() => useLeadEditForm(leadBase));
    expect(result.current.form.email).toBe("qa-codex-comercial@example.com");
  });

  it("editar Notas deja el patch sólo con notas y conserva el correo en el form", () => {
    const { result } = renderHook(() => useLeadEditForm(leadBase));
    act(() => result.current.set("notas", "Seguimiento"));
    expect(result.current.patch).toEqual({ notas: "Seguimiento" });
    expect(result.current.form.email).toBe("qa-codex-comercial@example.com");
    expect(result.current.dirty).toBe(true);
  });
});

describe("useLeadDetalleAcciones — gate Lead → Prospecto", () => {
  beforeEach(() => {
    calificarMutate.mockClear();
    calificarPending = false;
  });

  it("con faltantes ICP abre el gate y NO llama la RPC", () => {
    const { result } = renderHook(() => useLeadDetalleAcciones(leadBase.id, leadBase, {}));
    act(() => result.current.handleCalificar());
    expect(calificarMutate).not.toHaveBeenCalled();
    expect(result.current.faltantesGate.length).toBeGreaterThan(0);
    act(() => result.current.cerrarGate());
    expect(result.current.faltantesGate).toEqual([]);
  });

  it("con perfil completo ejecuta la transición", () => {
    const lead = { ...leadBase, ...icpCompleto };
    const { result } = renderHook(() => useLeadDetalleAcciones(lead.id, lead, {}));
    act(() => result.current.handleCalificar());
    expect(calificarMutate).toHaveBeenCalledWith(lead.id);
    expect(result.current.faltantesGate).toEqual([]);
  });

  it("doble clic es idempotente mientras corre la RPC", () => {
    const lead = { ...leadBase, ...icpCompleto };
    calificarPending = true;
    const { result } = renderHook(() => useLeadDetalleAcciones(lead.id, lead, {}));
    act(() => result.current.handleCalificar());
    expect(calificarMutate).not.toHaveBeenCalled();
  });

  it("guardar sin cambios no llama al servidor", async () => {
    const { result } = renderHook(() => useLeadDetalleAcciones(leadBase.id, leadBase, {}));
    await act(async () => { await result.current.handleSave(); });
    expect(actualizarMutateAsync).not.toHaveBeenCalled();
  });
});
