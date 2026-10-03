import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(process.cwd(), "supabase/migrations");
const definition = /CREATE OR REPLACE FUNCTION public\.crm_enviar_solicitud_pricing\(p_id uuid\)/;
const latest = readdirSync(DIR).filter((name) => name.endsWith(".sql")).sort().reverse()
  .map((name) => readFileSync(path.join(DIR, name), "utf8")).find((sql) => definition.test(sql));

describe("replay de notificaciones CRM pricing conserva el comportamiento vigente", () => {
  it("deduplica destinatarios e incluye pricing y Gerencia de Operaciones", () => {
    expect(latest).toMatch(/SELECT DISTINCT v\.organization_id, om\.user_id/);
    expect(latest).toMatch(/om\.role IN \('ejecutivo_pricing',\s*'gerente_operaciones'\)/);
  });
  it("mantiene el alcance por organización y la ruta actual de pricing", () => {
    expect(latest).toContain("v.organization_id IS DISTINCT FROM public.org_scope()");
    expect(latest).toContain("om.organization_id = v.organization_id");
    expect(latest).toContain("'/costeo/solicitudes?id=' || v.id");
  });
  it("no amplía la ACL ni cambia los estados/guardas del envío", () => {
    expect(latest).toContain("FROM PUBLIC, anon");
    expect(latest).toContain("TO authenticated, service_role");
    expect(latest).toContain("v.estado <> 'borrador'");
    expect(latest).toContain("v.created_by IS DISTINCT FROM auth.uid()");
  });
});
