import { describe, it, expect } from "vitest";
import { analizarEnv, PERMITIDOS } from "../../../scripts/audit-no-env";

/** JWT falso con el rol indicado (payload base64url, firma irrelevante). */
function jwtConRol(role: string): string {
  const payload = btoa(JSON.stringify({ iss: "supabase", role }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.firmafalsa1234567890`;
}

describe("audit-no-env · analizarEnv", () => {
  it("acepta un .env sólo con valores publishable", () => {
    const contenido = [
      "VITE_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co",
      `VITE_SUPABASE_PUBLISHABLE_KEY=${jwtConRol("anon")}`,
      "VITE_SUPABASE_PROJECT_ID=abcdefghijklmnopqrst",
    ].join("\n");

    expect(analizarEnv(".env", contenido)).toEqual([]);
  });

  it("detecta un JWT con rol service_role", () => {
    const v = analizarEnv(".env", `SOME_KEY=${jwtConRol("service_role")}`);
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('rol "service_role"');
  });

  it("detecta claves server-side prohibidas con valor", () => {
    const v = analizarEnv(".env", "SUPABASE_DB_PASSWORD=superSecreta123");
    expect(v).toEqual([".env: contiene el secreto server-side SUPABASE_DB_PASSWORD"]);
  });

  it("ignora comentarios y claves vacías", () => {
    const contenido = "# SENTRY_AUTH_TOKEN=sntrys_xxx\nSENTRY_AUTH_TOKEN=\n";
    expect(analizarEnv(".env", contenido)).toEqual([]);
  });

  it("declara los archivos .env permitidos en la raíz", () => {
    expect([...PERMITIDOS].sort()).toEqual([".env", ".env.e2e.example", ".env.example"]);
  });
});
