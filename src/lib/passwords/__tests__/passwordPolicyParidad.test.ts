import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PASSWORD_MIN } from "@/lib/passwords/policy";

/**
 * Ola 8 · B2 — La edge function no puede importar de `src/`, así que duplica el
 * mínimo. Este guardrail evita que los dos valores se separen con el tiempo
 * (el escenario original del hallazgo: frontend en 8 y backend en 6).
 */
describe("paridad de política de contraseñas frontend ↔ edge function", () => {
  it("createHandler.ts usa el mismo PASSWORD_MIN que la policy del frontend", () => {
    const src = readFileSync(
      resolve(process.cwd(), "supabase/functions/user-management/createHandler.ts"),
      "utf8",
    );
    const match = src.match(/const PASSWORD_MIN = (\d+);/);
    expect(match, "createHandler.ts debe declarar `const PASSWORD_MIN = <n>;`").not.toBeNull();
    expect(Number(match![1])).toBe(PASSWORD_MIN);
  });

  it("ninguna pantalla de contraseña reintroduce un mínimo propio", () => {
    const archivos = [
      "src/features/auth/components/SignupForm.tsx",
      "src/features/auth/routes/ResetPassword.tsx",
      "src/components/shared/dialogs/CambiarPasswordDialog.tsx",
      "src/features/admin/components/usuario/NuevoUsuarioDialog.tsx",
      "src/features/admin/components/usuario/NuevoUsuarioCredencialesSection.tsx",
    ];
    for (const rel of archivos) {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(src, `${rel} no debe declarar su propio PASSWORD_MIN`).not.toMatch(
        /const PASSWORD_MIN\s*=/,
      );
      expect(src, `${rel} no debe validar longitudes literales de contraseña`).not.toMatch(
        /password\.length < \d+/,
      );
    }
  });
});
