/**
 * Paridad exacta entre los roles que un `admin_org` puede asignar según:
 *  - el backend (`ASSIGNABLE_BY_ORG_ADMIN` en la edge function `user-management`)
 *  - la UI (`ASSIGNABLE_ROLES_ADMIN_ORG` / `ASSIGNABLE_ROLE_GROUPS` en roleCatalog)
 *
 * Debe fallar si divergen en cualquier dirección: un rol que la UI ofrece
 * pero el backend rechaza (falso 403), o un rol que el backend permite pero
 * la UI nunca ofrece (agujero de autorización silencioso). Los roles legacy
 * (`operador`, `viewer`) se excluyen de la comparación: el backend los
 * conserva por compatibilidad con asignaciones históricas, pero la UI nunca
 * los ofrece como opción nueva (ver `LEGACY_ROLES`).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ASSIGNABLE_ROLES_ADMIN_ORG, LEGACY_ROLES } from "@/features/admin/domain/roles/roleCatalog";

function parseAssignableByOrgAdmin(): Set<string> {
  const typesPath = resolve(
    __dirname,
    "../../../../../../supabase/functions/user-management/types.ts",
  );
  const src = readFileSync(typesPath, "utf-8");
  const match = src.match(
    /ASSIGNABLE_BY_ORG_ADMIN\s*=\s*new Set<string>\(\[([\s\S]*?)\]\)/,
  );
  if (!match) {
    throw new Error("No se pudo localizar ASSIGNABLE_BY_ORG_ADMIN en types.ts");
  }
  const roles = Array.from(match[1].matchAll(/"([a-z_]+)"/g)).map((m) => m[1]);
  return new Set(roles);
}

describe("ASSIGNABLE_BY_ORG_ADMIN (backend) vs ASSIGNABLE_ROLES_ADMIN_ORG (UI)", () => {
  it("coinciden exactamente, excluyendo roles legacy del backend", () => {
    const backend = parseAssignableByOrgAdmin();
    const backendModernos = new Set(
      [...backend].filter((r) => !(LEGACY_ROLES as readonly string[]).includes(r)),
    );
    const ui = new Set(ASSIGNABLE_ROLES_ADMIN_ORG as readonly string[]);

    const soloEnBackend = [...backendModernos].filter((r) => !ui.has(r));
    const soloEnUi = [...ui].filter((r) => !backendModernos.has(r));

    expect(soloEnBackend, `Roles permitidos en backend pero no ofrecidos por la UI: ${soloEnBackend.join(", ")}`).toEqual([]);
    expect(soloEnUi, `Roles ofrecidos por la UI pero rechazados en backend: ${soloEnUi.join(", ")}`).toEqual([]);
  });
});
