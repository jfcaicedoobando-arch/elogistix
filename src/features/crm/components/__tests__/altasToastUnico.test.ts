import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regresión: un solo aviso de éxito por alta.
 * La capa responsable del toast es el hook de mutación
 * (useCrearLead / useCrearOportunidad), porque además comunica
 * el aviso de actividad automática. Los call-sites no deben duplicarlo.
 */
const leer = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const CALL_SITES = [
  "src/features/crm/components/NuevoLeadDialog.tsx",
  "src/features/crm/components/quickCreate/QuickCreateLeadDialog.tsx",
  "src/features/crm/hooks/useQuickCreateOportunidad.ts",
];

describe("altas CRM: toast de éxito único", () => {
  it("los call-sites de alta no emiten 'Lead creado' ni 'Oportunidad creada'", () => {
    for (const archivo of CALL_SITES) {
      const src = leer(archivo);
      expect(src).not.toContain("Lead creado");
      expect(src).not.toContain("Oportunidad creada");
    }
  });

  it("NuevaOportunidadDialog sólo avisa en edición", () => {
    const src = leer("src/features/crm/components/NuevaOportunidadDialog.tsx");
    expect(src).not.toContain("Oportunidad creada");
    expect(src).toContain("Oportunidad actualizada");
  });

  it("los hooks conservan el único aviso de éxito", () => {
    const leads = leer("src/features/crm/hooks/leads/mutations.ts");
    const ops = leer("src/features/crm/hooks/useOportunidades.ts");
    expect(leads.match(/"Lead creado"/g)).toHaveLength(1);
    expect(ops.match(/"Oportunidad creada"/g)).toHaveLength(1);
    // Mensaje especial de actividad automática intacto.
    expect(ops).toContain("avisoActividad");
  });
});
