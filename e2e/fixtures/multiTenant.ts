/**
 * Fixture que carga el resultado del provisioner multi-tenant.
 *
 * El JSON en `e2e/.tmp/multi-tenant.json` es generado por
 * `scripts/e2e/provision-multi-tenant.ts` — que a su vez invoca a la edge
 * function `e2e-provision-multi-tenant`. Ese archivo es git-ignored y contiene
 * IDs de dominio + credenciales + paths de storage de las dos orgs E2E.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface OrgFixture {
  organization_id: string;
  admin_user_id: string;
  admin_email: string;
  cliente_id: string;
  embarque_id: string;
  factura_id: string;
  cotizacion_id: string;
  storage_bucket: string;
  storage_path: string;
  marker: string;
}
export interface MultiTenantFixture {
  org_a: OrgFixture;
  org_b: OrgFixture;
  creds: {
    a: { email: string; password: string };
    b: { email: string; password: string };
  };
}

const FIXTURE_PATH = resolve(process.cwd(), "e2e/.tmp/multi-tenant.json");

export function multiTenantFixturePath(): string {
  return FIXTURE_PATH;
}

export function loadMultiTenantFixture(): MultiTenantFixture | null {
  if (!existsSync(FIXTURE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as MultiTenantFixture;
  } catch {
    return null;
  }
}
