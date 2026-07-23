/**
 * Sprint 2 · ítem 1 — Paridad `ROLE_EQUIVALENTS` (TS) ↔ `has_role()` (BD).
 *
 * `public.has_role()` contiene un `CASE _role WHEN … THEN ARRAY[…]` que agrupa
 * roles funcionales. El helper de frontend `roleSatisfies()` replica esa tabla
 * en `ROLE_EQUIVALENTS`. Si alguien cambia la BD sin tocar TS (o viceversa),
 * los guardas del front pueden aceptar/negar roles que RLS decide al revés.
 *
 * Este test hace fallar CI ante cualquier drift: mantiene un snapshot exacto
 * del mapeo actual en BD. Si cambias `has_role()` en una migración, DEBES
 * actualizar tanto `ROLE_EQUIVALENTS` como este snapshot en el mismo PR.
 */
import { describe, it, expect } from "vitest";
import { ROLE_EQUIVALENTS } from "@/lib/auth/roleHierarchy";
import type { AppRole } from "@/types/appRole";

/**
 * Snapshot literal del `CASE` que vive en `public.has_role()`:
 * `supabase/migrations/20260622160509_*.sql` (última redefinición).
 *
 * Reglas:
 * - Cada clave debe existir en `AppRole`.
 * - Roles NO listados en el CASE caen al `ELSE ARRAY[_role]` → se declaran
 *   como `[role]` en el snapshot (coincidencia exacta).
 */
const HAS_ROLE_SNAPSHOT: Record<AppRole, readonly AppRole[]> = {
  super_admin: ["super_admin"],
  admin: ["admin", "admin_org", "super_admin"],
  admin_org: ["admin_org", "super_admin"],
  operador: [
    "operador",
    "coordinador_logistico",
    "ejecutivo_pricing",
    "gerente_operaciones",
    "admin",
    "admin_org",
    "super_admin",
  ],
  viewer: [
    "viewer",
    "customer_service",
    "vendedor",
    "contador",
    "tesorero",
    "auxiliar_contable",
    "ejecutivo_cobranza",
    "ejecutivo_pricing",
    "gerente_operaciones",
    "gerente_visor",
    "gerente_comercial",
    "coordinador_logistico",
    "admin",
    "admin_org",
    "super_admin",
  ],
  vendedor: ["vendedor", "gerente_comercial", "admin_org", "super_admin"],
  contador: ["contador", "auxiliar_contable", "admin_org", "super_admin"],
  tesorero: ["tesorero", "admin_org", "super_admin"],
  auxiliar_contable: ["auxiliar_contable", "contador", "admin_org", "super_admin"],
  ejecutivo_cobranza: ["ejecutivo_cobranza", "contador", "admin_org", "super_admin"],
  // ELSE branch → [_role]
  coordinador_logistico: ["coordinador_logistico"],
  ejecutivo_pricing: ["ejecutivo_pricing"],
  gerente_operaciones: ["gerente_operaciones"],
  gerente_visor: ["gerente_visor"],
  gerente_comercial: ["gerente_comercial"],
  customer_service: ["customer_service"],
  cliente: ["cliente"],
  agente_carga: ["agente_carga"],
};

const sortRoles = (roles: readonly AppRole[]) => [...roles].sort();

describe("roleHierarchy · invariante ROLE_EQUIVALENTS ↔ has_role() (Sprint 2)", () => {
  it("mismas claves en TS y en el snapshot de BD", () => {
    const tsKeys = new Set(Object.keys(ROLE_EQUIVALENTS));
    const dbKeys = new Set(Object.keys(HAS_ROLE_SNAPSHOT));
    const missingEnTs = [...dbKeys].filter((k) => !tsKeys.has(k));
    const extraEnTs = [...tsKeys].filter((k) => !dbKeys.has(k));
    expect(missingEnTs, `Roles en BD que faltan en TS: ${missingEnTs.join(", ")}`).toEqual([]);
    expect(extraEnTs, `Roles en TS ausentes del snapshot de BD: ${extraEnTs.join(", ")}`).toEqual([]);
  });

  it("cada grupo tiene exactamente los mismos miembros que en BD", () => {
    const drifts: string[] = [];
    for (const role of Object.keys(HAS_ROLE_SNAPSHOT) as AppRole[]) {
      const ts = sortRoles(ROLE_EQUIVALENTS[role]);
      const db = sortRoles(HAS_ROLE_SNAPSHOT[role]);
      if (ts.join(",") !== db.join(",")) {
        drifts.push(
          `${role}: TS=[${ts.join(",")}] vs BD=[${db.join(",")}]`,
        );
      }
    }
    expect(drifts, `Drift TS↔BD: ${drifts.join(" | ")}`).toEqual([]);
  });
});
