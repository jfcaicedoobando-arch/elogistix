import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
function sesion(organizationId = "org", userId = "usuario") {
  setAuthSnapshot({ userId, organizationId, email: null, organizationName: null, role: "admin", effectiveRole: "admin" });
  syncActiveOrganizationScope({ organizationId, userId });
}
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rows: {} as Record<string, unknown[]>, calls: [] as { table: string; method: string; args: unknown[] }[], prospecto: vi.fn(), tarifa: vi.fn(), tarifas: vi.fn(), errorTable: "", hold: null as Promise<void> | null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const filters: [string, unknown][] = []; let range: number[] | null = null; let single = false;
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in", "order", "range", "maybeSingle"]) q[method] = (...args: unknown[]) => {
    m.calls.push({ table, method, args });
    if (method === "eq" || method === "is" || method === "in") filters.push([String(args[0]), args[1]]);
    if (method === "range") range = args as number[];
    if (method === "maybeSingle") single = true;
    return q;
  };
  q.then = (resolve: (value: unknown) => unknown) => {
    const rows = (m.rows[table] ?? []).filter((row) => filters.every(([key, value]) => {
      const actual = key.split(".").reduce<unknown>((v, k) => v && typeof v === "object" ? Reflect.get(v, k) : undefined, row);
      return Array.isArray(value) ? value.includes(actual) : actual === value;
    }));
    return Promise.resolve(m.hold).then(() => resolve({ data: single ? rows[0] ?? null : range ? rows.slice(range[0], range[1] + 1) : rows, error: m.errorTable === table ? new Error("Falló consulta") : null }));
  };
  return q;
} } }));
vi.mock("@/features/crm/services/prospectoSearch", () => ({ buscarProspectoOportunidad: m.prospecto }));
vi.mock("@/features/costeo/services/topTarifas", () => ({ fetchTarifaVigentePorId: m.tarifa, fetchTarifasVigentesPorIds: m.tarifas }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: vi.fn() }));
import { fetchContextoPricingCotizacion } from "../contextoPricingCotizacion";
import { fetchOpcionesPricingCotizacion } from "../opcionesPricingCotizacion";
const params = { organizationId: "org", oportunidadId: "op", solicitudId: "sol", tarifaId: "tarifa" };
const solicitud = { organization_id: "org", deleted_at: null, id: "sol", folio: "SOL-1", oportunidad_id: "op", tarifa_tarifario_id: "tarifa", estado: "respondida", incoterm: "FOB", cantidad: 3, servicio: "Marítimo", tipo_carga: "40 HC", oportunidad: { id: "op", organization_id: "org", deleted_at: null, cliente_id: "cliente", etapa: { nombre: "En negociación", organization_id: "org", activa: true, tipo: "abierta", deleted_at: null } } };
beforeEach(() => {
  sesion();
  m.calls = []; m.errorTable = ""; m.hold = null;
  m.rows = { crm_solicitudes_pricing: [solicitud], crm_oportunidades: [{ id: "op", organization_id: "org", deleted_at: null, cliente_id: "cliente", moneda: "USD", etapa: solicitud.oportunidad.etapa }], clientes: [{ id: "cliente", organization_id: "org", deleted_at: null }], crm_leads: [{ id: "lead", organization_id: "org", deleted_at: null }], costeo_tarifas: [], costeo_tarifas_vigentes_v: [{ id: "tarifa", organization_id: "org" }] };
  m.tarifa.mockReset().mockResolvedValue({ id: "tarifa" }); m.tarifas.mockReset().mockResolvedValue([{ id: "tarifa" }]); m.prospecto.mockReset().mockResolvedValue({ id: "op", leadId: "lead" });
});
describe("resolver Pricing real con I/O sustituido", () => {
  it("resolver no retorna datos de una sesión revocada mientras espera I/O", async () => {
    let release!: () => void;
    m.hold = new Promise<void>((resolve) => { release = resolve; });
    const pending = fetchContextoPricingCotizacion(params);
    sesion("otra-org"); release();
    await expect(pending).rejects.toThrow("cambió el usuario o la organización");
  });

  it("rechaza el tenant solicitado que no coincide con la sesión antes de consultar", async () => {
    await expect(fetchContextoPricingCotizacion({ ...params, organizationId: "otra-org" })).rejects.toThrow("cambió el usuario");
    await expect(fetchOpcionesPricingCotizacion({ organizationId: "otra-org", clienteId: "cliente" })).rejects.toThrow("cambió el usuario");
    expect(m.calls).toEqual([]);
  });
  it.each(["crm_solicitudes_pricing", "crm_oportunidades", "clientes", "costeo_tarifas_vigentes_v"])("filtra organización explícita en %s", async (table) => {
    m.rows[table] = m.rows[table].map((row) => ({ ...Object(row), organization_id: "otra-org" }));
    await expect(fetchContextoPricingCotizacion(params)).rejects.toThrow();
    expect(m.calls).toContainEqual({ table, method: "eq", args: ["organization_id", "org"] });
  });
  it("no acepta lead ajeno aunque el buscador histórico devuelva el mismo ID", async () => {
    m.rows.crm_oportunidades = [{ id: "op", cliente_id: null, lead_id: "lead", organization_id: "org", deleted_at: null, moneda: "MXN", etapa: solicitud.oportunidad.etapa }];
    m.rows.crm_leads = [{ id: "lead", organization_id: "otra-org", deleted_at: null }];
    await expect(fetchContextoPricingCotizacion(params)).rejects.toThrow("prospecto");
    expect(m.prospecto).not.toHaveBeenCalled();
  });
  it("panel excluye requests de otra organización sin devolver un parcial ajeno", async () => {
    m.rows.crm_solicitudes_pricing = [{ ...solicitud, organization_id: "otra-org" }];
    expect(await fetchOpcionesPricingCotizacion({ organizationId: "org", clienteId: "cliente" })).toEqual([]);
  });

  it("resuelve cliente existente sin relajar ni llamar buscador de prospectos", async () => {
    const c = await fetchContextoPricingCotizacion(params);
    expect(c.destinatario).toMatchObject({ clienteId: "cliente", oportunidadId: "op", prospecto: null });
    expect(c.solicitud).toMatchObject({ incoterm: "FOB", cantidad: 3 }); expect(m.prospecto).not.toHaveBeenCalled();
  });
  it("reutiliza elegibilidad de prospectos cuando no hay cliente", async () => {
    m.rows.crm_oportunidades = [{ id: "op", cliente_id: null, lead_id: "lead", organization_id: "org", deleted_at: null, moneda: "MXN", etapa: solicitud.oportunidad.etapa }];
    const c = await fetchContextoPricingCotizacion(params); expect(c.destinatario?.prospecto?.leadId).toBe("lead"); expect(m.prospecto).toHaveBeenCalledWith("op");
  });
  it("enlace histórico no infiere solicitud por tarifa", async () => {
    const c = await fetchContextoPricingCotizacion({ ...params, solicitudId: null }); expect(c.solicitud).toBeNull();
    expect(m.calls.some((x) => x.table === "crm_solicitudes_pricing")).toBe(false);
  });
  it.each(["cancelada", "borrador", "enviada"])("rechaza solicitud %s", async (estado) => {
    m.rows.crm_solicitudes_pricing = [{ ...solicitud, estado }]; await expect(fetchContextoPricingCotizacion(params)).rejects.toThrow("solicitud");
  });
  it("rechaza solicitud de otra oportunidad", async () => {
    m.rows.crm_solicitudes_pricing = [{ ...solicitud, oportunidad_id: "otra" }]; await expect(fetchContextoPricingCotizacion(params)).rejects.toThrow("no corresponde");
  });
  it("rechaza tarifa ajena pero permite respuesta ligada", async () => {
    m.rows.crm_solicitudes_pricing = [{ ...solicitud, tarifa_tarifario_id: null }];
    await expect(fetchContextoPricingCotizacion(params)).rejects.toThrow("no pertenece");
    m.rows.costeo_tarifas = [{ id: "tarifa", organization_id: "org", solicitud_pricing_id: "sol" }]; expect((await fetchContextoPricingCotizacion(params)).tarifa.id).toBe("tarifa");
  });
  it("cotiza Respondida/En negociación desde la respuesta sin elegir una tarifa de catálogo", async () => {
    m.rows.crm_solicitudes_pricing = [{ ...solicitud, tarifa_tarifario_id: null, incoterm: "FAS", cantidad: 1 }];
    m.rows.costeo_tarifas = [{ id: "tarifa", organization_id: "org", solicitud_pricing_id: "sol" }];
    const contexto = await fetchContextoPricingCotizacion(params);
    expect(contexto.destinatario).toMatchObject({ oportunidadId: "op", clienteId: "cliente", etapaNombre: "En negociación" });
    expect(contexto.solicitud).toMatchObject({ id: "sol", tarifa_tarifario_id: null, incoterm: "FAS", cantidad: 1 });
    expect(contexto.tarifa.id).toBe("tarifa");
    const opciones = await fetchOpcionesPricingCotizacion({ organizationId: "org", oportunidadId: "op" });
    expect(opciones).toHaveLength(1);
    expect(opciones[0]).toMatchObject({ organizationId: "org", solicitudId: "sol", oportunidadId: "op", incoterm: "FAS", cantidad: 1 });
  });
  it.each([
    { organization_id: "otra-org", solicitud_pricing_id: "sol" },
    { organization_id: "org", solicitud_pricing_id: "otra-solicitud" },
  ])("rechaza una tarifa de respuesta con otro tenant o linaje (%o)", async (vinculo) => {
    m.rows.crm_solicitudes_pricing = [{ ...solicitud, tarifa_tarifario_id: null }];
    m.rows.costeo_tarifas = [{ id: "tarifa", ...vinculo }];
    await expect(fetchContextoPricingCotizacion(params)).rejects.toThrow("no pertenece");
  });
  it("rechaza empresa eliminada, tarifa vencida y error explícito", async () => {
    m.rows.clientes = []; await expect(fetchContextoPricingCotizacion(params)).rejects.toThrow("empresa");
    m.rows.clientes = [{ id: "cliente", organization_id: "org", deleted_at: null }]; m.rows.costeo_tarifas_vigentes_v = []; await expect(fetchContextoPricingCotizacion(params)).rejects.toThrow("vigente");
    m.errorTable = "crm_solicitudes_pricing"; await expect(fetchContextoPricingCotizacion(params)).rejects.toThrow("Falló consulta");
  });
  it("preserva dos solicitudes que comparten tarifa con metadata distinta", async () => {
    m.rows.crm_solicitudes_pricing = [solicitud, { ...solicitud, id: "sol2", incoterm: "CIF", cantidad: 5 }];
    const opciones = await fetchOpcionesPricingCotizacion({ organizationId: "org", clienteId: "cliente" });
    expect(opciones).toHaveLength(2); expect(opciones.map((o) => [o.solicitudId, o.incoterm, o.cantidad])).toEqual([["sol", "FOB", 3], ["sol2", "CIF", 5]]);
  });
  it("lee solicitudes de la segunda página y mantiene ambos filtros", async () => {
    m.rows.crm_solicitudes_pricing = Array.from({ length: 1001 }, (_, i) => ({ ...solicitud, id: `sol${i}` }));
    expect(await fetchOpcionesPricingCotizacion({ organizationId: "org", clienteId: "cliente", oportunidadId: "op" })).toHaveLength(1001);
    expect(m.calls).toContainEqual({ table: "crm_solicitudes_pricing", method: "range", args: [1000, 1999] });
    expect(m.calls.filter((x) => x.table === "crm_solicitudes_pricing" && x.method === "eq" && x.args[0] === "oportunidad.cliente_id")).toHaveLength(2);
  });
});
