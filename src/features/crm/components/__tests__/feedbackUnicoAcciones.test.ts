import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regresión: una sola notificación por acción.
 * La capa responsable es el hook de mutación; los call-sites no repiten
 * el aviso salvo el Sheet de conversión, que emite un aviso accionable
 * ("Abrir oportunidad") y silencia el del hook.
 */
const leer = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("CRM: feedback único por acción", () => {
  it("ActividadRowActions no notifica completar/posponer", () => {
    const src = leer("src/features/crm/components/ActividadRowActions.tsx");
    expect(src).not.toContain("crmToast");
    expect(src).not.toContain("Actividad completada");
    expect(src).not.toContain("Pospuesto");
  });

  it("los hooks de actividades conservan el único aviso", () => {
    const src = leer("src/features/crm/hooks/useActividades.ts");
    expect(src.match(/"Actividad completada"/g)).toHaveLength(1);
    expect(src.match(/"Actividad pospuesta"/g)).toHaveLength(1);
  });

  it("ConvertirLeadDialog no duplica éxito ni error", () => {
    const src = leer("src/features/crm/components/ConvertirLeadDialog.tsx");
    expect(src).not.toContain("crmToast");
    expect(src).not.toContain("notifyError");
  });

  it("ConvertirLeadSheet conserva su aviso accionable y silencia el del hook", () => {
    const src = leer("src/features/crm/components/ConvertirLeadSheet.tsx");
    expect(src).toContain("silencioso: true");
    expect(src).toContain("Abrir oportunidad");
    expect(src).not.toContain("crmToast");
  });

  it("useConvertirLead respeta el flag silencioso", () => {
    const src = leer("src/features/crm/hooks/leads/convertir.ts");
    expect(src).toContain("if (!variables.silencioso)");
  });

  it("useLeadDetalleAcciones no duplica 'Lead eliminado'", () => {
    const src = leer("src/features/crm/hooks/useLeadDetalleAcciones.ts");
    expect(src).not.toContain("Lead eliminado");
    expect(src).toContain("ROUTES.CRM_LEADS");
  });

  it("EtapasPipelineEditor deja el aviso al hook", () => {
    const editor = leer("src/features/crm/components/EtapasPipelineEditor.tsx");
    const hook = leer("src/features/crm/hooks/useEtapasPipeline.ts");
    expect(editor).not.toContain("Etapa actualizada");
    expect(hook.match(/"Etapa actualizada"/g)).toHaveLength(1);
  });

  it("NuevaOportunidadDialog no duplica el error de guardado", () => {
    const src = leer("src/features/crm/components/NuevaOportunidadDialog.tsx");
    expect(src).not.toContain("No se pudo guardar");
  });
});
