import { describe, expect, it } from "vitest";
import type { AppRole } from "@/types/appRole";
import {
  permisoPasarEmpresaAProspecto, type ActorProspecto, type EmpresaProspecto, type VinculosProspecto,
} from "../pasarEmpresaAProspecto";

const actor: ActorProspecto = {
  userId: "kam", role: "vendedor", orgRole: "vendedor", organizationId: "org",
  membershipOrganizationId: "org", organizationActive: true,
};
const empresa: EmpresaProspecto = {
  id: "empresa", organization_id: "org", created_by: "kam", deleted_at: null,
  lead_origen_id: null, cliente_id: null, estado_crm: "Lead",
};
const sinVinculos: VinculosProspecto = { lead: null, oportunidades: [] };
const conVinculos: VinculosProspecto = {
  lead: { id: "lead", organization_id: "org", vendedor_id: "kam", deleted_at: null, estado: "Nuevo", cliente_convertido_id: null },
  oportunidades: [{ organization_id: "org", crm_oportunidades: {
    id: "op", organization_id: "org", vendedor_id: "kam", deleted_at: null, lead_id: "lead",
  } }],
};
const conLead = { ...empresa, lead_origen_id: "lead" };

describe("capacidad específica de pasar empresa a prospecto", () => {
  it("KAM propio espera verificar vínculos y luego puede continuar sin lead", () => {
    expect(permisoPasarEmpresaAProspecto(actor, empresa).estado).toBe("comprobar");
    expect(permisoPasarEmpresaAProspecto(actor, empresa, sinVinculos).estado).toBe("permitido");
  });
  it("permite vínculos vigentes propios de la misma organización", () => {
    expect(permisoPasarEmpresaAProspecto(actor, conLead, conVinculos).estado).toBe("permitido");
  });
  it.each([null, "otro"])("rechaza empresa con creador %s aunque su lead sea propio", (created_by) => {
    expect(permisoPasarEmpresaAProspecto(actor, { ...conLead, created_by }, conVinculos).estado).toBe("denegado");
  });
  it.each<Partial<EmpresaProspecto>>([
    { organization_id: "otra-org" }, { deleted_at: "2026-10-16" },
    { cliente_id: "cliente" }, { estado_crm: "Cliente" },
  ])("rechaza empresa fuera de alcance o cliente: %j", (cambio) => {
    expect(permisoPasarEmpresaAProspecto(actor, { ...empresa, ...cambio }, sinVinculos).estado).toBe("denegado");
  });
  it.each<Partial<ActorProspecto>>([
    { userId: null }, { orgRole: null }, { orgRole: "viewer" },
    { membershipOrganizationId: "otra-org" }, { organizationId: null },
  ])("no usa el rol global vendedor como fallback: %j", (cambio) => {
    expect(permisoPasarEmpresaAProspecto({ ...actor, ...cambio }, empresa, sinVinculos).estado).toBe("oculto");
  });
  it("rechaza la organización inactiva para KAM", () => {
    expect(permisoPasarEmpresaAProspecto({ ...actor, organizationActive: false }, empresa, sinVinculos).estado).toBe("denegado");
  });
  it.each<AppRole>([
    "viewer", "gerente_visor", "customer_service", "gerente_comercial", "ejecutivo_pricing", "tesorero", "ejecutivo_cobranza", "cliente", "agente_carga",
  ])("%s no obtiene esta capacidad por canEditCrm u otra jerarquía comercial", (role) => {
    expect(permisoPasarEmpresaAProspecto({ ...actor, role, orgRole: role }, empresa, sinVinculos).estado).toBe("oculto");
  });
  it.each<AppRole>([
    "super_admin", "admin", "admin_org", "operador", "coordinador_logistico", "gerente_operaciones", "contador", "auxiliar_contable",
  ])("preserva la ruta writer existente para %s sin restringir propietarios", (role) => {
    expect(permisoPasarEmpresaAProspecto({ ...actor, role, orgRole: role, organizationActive: false },
      { ...conLead, created_by: "otro" }, { lead: null, oportunidades: [] }).estado).toBe("permitido");
  });
  it("conserva selección de tenant para super admin y exige tenant propio al resto", () => {
    expect(permisoPasarEmpresaAProspecto({ ...actor, role: "super_admin", membershipOrganizationId: "otra-org" }, empresa).estado).toBe("permitido");
    expect(permisoPasarEmpresaAProspecto({ ...actor, role: "contador", orgRole: "contador", membershipOrganizationId: "otra-org" }, empresa).estado).toBe("oculto");
  });
  it.each<Partial<NonNullable<VinculosProspecto["lead"]>>>([
    { id: "otro" }, { vendedor_id: null }, { vendedor_id: "otro" }, { organization_id: "otra-org" },
    { deleted_at: "2026-10-16" }, { estado: "Convertido" }, { cliente_convertido_id: "cliente" },
  ])("rechaza lead ajeno, borrado o convertido: %j", (cambio) => {
    const vinculos = { ...conVinculos, lead: { ...conVinculos.lead!, ...cambio } };
    expect(permisoPasarEmpresaAProspecto(actor, conLead, vinculos).estado).toBe("denegado");
  });
  it("rechaza una referencia de lead invisible en vez de tratarla como inexistente", () => {
    expect(permisoPasarEmpresaAProspecto(actor, conLead, sinVinculos).estado).toBe("denegado");
  });
  it.each<Partial<NonNullable<VinculosProspecto["oportunidades"][number]["crm_oportunidades"]>>>([
    { vendedor_id: null }, { vendedor_id: "otro" }, { organization_id: "otra-org" },
    { deleted_at: "2026-10-16" }, { lead_id: "otro-lead" }, { lead_id: null },
  ])("rechaza oportunidad ajena, borrada o incongruente: %j", (cambio) => {
    const oportunidades = [{ organization_id: "org", crm_oportunidades: { ...conVinculos.oportunidades[0].crm_oportunidades!, ...cambio } }];
    expect(permisoPasarEmpresaAProspecto(actor, conLead, { ...conVinculos, oportunidades }).estado).toBe("denegado");
  });
  it("rechaza cualquier enlace inválido, aunque el primero sea propio", () => {
    const oportunidades = [...conVinculos.oportunidades, { organization_id: "otra-org", crm_oportunidades: conVinculos.oportunidades[0].crm_oportunidades }];
    expect(permisoPasarEmpresaAProspecto(actor, conLead, { ...conVinculos, oportunidades }).estado).toBe("denegado");
  });
  it("rechaza oportunidades invisibles y oportunidades sin lead de empresa", () => {
    expect(permisoPasarEmpresaAProspecto(actor, conLead, { ...conVinculos,
      oportunidades: [{ organization_id: "org", crm_oportunidades: null }] }).estado).toBe("denegado");
    expect(permisoPasarEmpresaAProspecto(actor, empresa, conVinculos).estado).toBe("denegado");
  });
});
