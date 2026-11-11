import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regresión: una sola notificación por acción.
 * Los componentes y controladores dejan el aviso al hook de mutación.
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
