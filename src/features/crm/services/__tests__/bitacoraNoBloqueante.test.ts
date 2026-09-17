/**
 * Falsos errores por bitácora (hallazgos P1-1 y P2-4…8).
 *
 * En los seis flujos la escritura principal (UPDATE o RPC transaccional) YA
 * ocurrió; si `registrarActividad` falla, el servicio debe RESOLVER con
 * `avisoActividad` en vez de rechazar (antes la UI decía "no se pudo…" aunque
 * el cambio ya estaba guardado y, al mover etapa, se saltaban las
 * automatizaciones).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: vi.fn(async () => {
    throw new Error("bitacora caida");
  }),
}));

import {
  actualizarOportunidad,
  moverEtapaOportunidad,
  eliminarOportunidad,
} from "../oportunidades";
import { convertirLead } from "../leads/convertir";
import { vincularOCrearOportunidadParaCotizacion } from "../vincularCotizacion/vincularOCrear";
import { propagarConversionProspectoCRM } from "../vincularCotizacion/propagarConversion";
import type { CrmLeadRow } from "@/features/crm/domain/leads/constants";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

const filaOk = { data: { id: "op-1", updated_at: "2026-01-02T00:00:00Z" }, error: null };

describe("bitácora no bloqueante — oportunidades", () => {
  it("actualizar: guarda y devuelve aviso en vez de rechazar", async () => {
    mock.setTableResult("crm_oportunidades", filaOk);
    const r = await actualizarOportunidad({ id: "op-1", patch: { nombre: "Nuevo" } });
    expect(r.updatedAt).toBe("2026-01-02T00:00:00Z");
    expect(r.avisoActividad).toMatch(/bitacora caida/);
  });

  it("mover etapa: devuelve sello + aviso (el caller sigue con automatizaciones)", async () => {
    mock.setTableResult("crm_oportunidades", filaOk);
    const r = await moverEtapaOportunidad({ id: "op-1", etapa_id: "e-2", probabilidad: 60 });
    expect(r.updatedAt).toBe("2026-01-02T00:00:00Z");
    expect(r.avisoActividad).toMatch(/bitacora caida/);
  });

  it("eliminar: el soft-delete no se reporta como fallo", async () => {
    mock.setTableResult("crm_oportunidades", filaOk);
    const r = await eliminarOportunidad("op-1", "u-1");
    expect(r.avisoActividad).toMatch(/bitacora caida/);
  });
});

describe("bitácora no bloqueante — RPCs transaccionales", () => {
  const lead = { id: "lead-1", empresa: "Beta SA", interes_modo: "Aéreo" } as CrmLeadRow;

  it("convertir lead: la conversión atómica se conserva con aviso", async () => {
    mock.setRpcResult("convertir_lead_rpc", {
      data: { cliente_id: "cli-1", oportunidad_id: "op-9", creado: true },
      error: null,
    });
    const r = await convertirLead(
      {
        lead,
        crearCliente: false,
        clienteIdExistente: null,
        nombreOportunidad: "Op",
        montoEstimado: 100,
        moneda: "MXN",
        fechaEstimadaCierre: "2026-12-31",
      },
      { id: "u-1", email: "a@b.com" },
    );
    expect(r.oportunidadId).toBe("op-9");
    expect(r.avisoActividad).toMatch(/bitacora caida/);
  });

  it("vincular cotización: el vínculo persiste con aviso", async () => {
    mock.setRpcResult("crm_vincular_cotizacion", {
      data: { oportunidad_id: "op-1", lead_id: "lead-1", updated_at: "2026-01-03T00:00:00Z" },
      error: null,
    });
    const r = await vincularOCrearOportunidadParaCotizacion({
      cotizacionId: "cot-1",
      leadId: "lead-1",
    });
    expect(r.oportunidadId).toBe("op-1");
    expect(r.avisoActividad).toMatch(/bitacora caida/);
  });

  it("propagar conversión: la propagación no se reporta como fallo", async () => {
    mock.setRpcResult("crm_propagar_conversion_cliente", { data: {}, error: null });
    const r = await propagarConversionProspectoCRM({
      oportunidadId: "op-1",
      clienteId: "c-1",
      clienteNombre: "Acme",
    });
    expect(r.avisoActividad).toMatch(/bitacora caida/);
  });
});
