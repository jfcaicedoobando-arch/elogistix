import type { AppRole } from "@/types/appRole";

export interface ActorProspecto {
  userId: string | null;
  role: AppRole | null;
  orgRole: AppRole | null;
  organizationId: string | null;
  membershipOrganizationId: string | null;
  organizationActive: boolean;
}

export interface EmpresaProspecto {
  id: string;
  organization_id: string;
  created_by: string | null;
  deleted_at: string | null;
  lead_origen_id: string | null;
  cliente_id: string | null;
  estado_crm?: string | null;
}

interface PropietarioProspecto {
  id: string;
  organization_id: string;
  vendedor_id: string | null;
  deleted_at: string | null;
}

export interface VinculosProspecto {
  lead: (PropietarioProspecto & { estado: string; cliente_convertido_id: string | null }) | null;
  oportunidades: Array<{
    organization_id: string;
    crm_oportunidades: (PropietarioProspecto & { lead_id: string | null }) | null;
  }>;
}

export interface PermisoProspecto {
  estado: "permitido" | "comprobar" | "denegado" | "oculto";
  motivo?: string;
}

// Espejo de _assert_writer + roles_jerarquia, conservando su ruta global previa.
const WRITERS: readonly AppRole[] = [
  "super_admin", "admin", "admin_org", "operador", "coordinador_logistico",
  "gerente_operaciones", "contador", "auxiliar_contable",
];

function esWriter(actor: ActorProspecto, miembroActivo: boolean): boolean {
  return !!actor.role && WRITERS.includes(actor.role)
    && (actor.role === "super_admin" || miembroActivo);
}

function vinculosPropios(actor: ActorProspecto, empresa: EmpresaProspecto, vinculos: VinculosProspecto): boolean {
  const propioYVivo = (registro: PropietarioProspecto | null) => !!registro
    && registro.organization_id === actor.organizationId && registro.vendedor_id === actor.userId
    && registro.deleted_at === null;
  const leadValido = !empresa.lead_origen_id || (vinculos.lead?.id === empresa.lead_origen_id
    && propioYVivo(vinculos.lead) && vinculos.lead.estado !== "Convertido"
    && !vinculos.lead.cliente_convertido_id);
  const oportunidadesValidas = vinculos.oportunidades.every((vinculo) =>
    !!empresa.lead_origen_id && vinculo.organization_id === actor.organizationId
    && propioYVivo(vinculo.crm_oportunidades)
    && vinculo.crm_oportunidades?.lead_id === empresa.lead_origen_id);
  return leadValido && oportunidadesValidas;
}

/** Capacidad exclusiva de crm_empresa_pasar_a_prospecto; el RPC vuelve a validarla. */
export function permisoPasarEmpresaAProspecto(
  actor: ActorProspecto, empresa: EmpresaProspecto, vinculos?: VinculosProspecto,
): PermisoProspecto {
  const { userId, organizationId } = actor;
  const miembroActivo = !!organizationId && actor.membershipOrganizationId === organizationId;
  const writer = esWriter(actor, miembroActivo);
  const vendedor = actor.orgRole === "vendedor" && miembroActivo;
  if (!userId || (!writer && !vendedor)) return { estado: "oculto" };
  if (!organizationId || empresa.organization_id !== organizationId || empresa.deleted_at !== null) {
    return { estado: "denegado", motivo: "La empresa no está disponible en la organización activa." };
  }
  if (writer) return { estado: "permitido" };
  if (!actor.organizationActive) {
    return { estado: "denegado", motivo: "La organización activa no está habilitada." };
  }
  if (empresa.cliente_id || empresa.estado_crm === "Cliente") {
    return { estado: "denegado", motivo: "La empresa ya es cliente." };
  }
  if (empresa.created_by !== userId) {
    return { estado: "denegado", motivo: "Sólo puedes pasar a prospecto las empresas creadas por ti." };
  }
  if (!vinculos) return { estado: "comprobar" };
  if (!vinculosPropios(actor, empresa, vinculos)) {
    return { estado: "denegado", motivo: "El lead y las oportunidades vinculadas deben estar vigentes, ser tuyos y corresponder a esta empresa y organización." };
  }
  return { estado: "permitido" };
}
