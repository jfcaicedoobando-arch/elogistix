/**
 * R2 seguridad · P1 (B-1) — El candado de re-invitación debe estar cableado en
 * AMBOS flujos de portal antes de crear/resetear la cuenta.
 */
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

async function leer(archivo: string): Promise<string> {
  return await Deno.readTextFile(new URL(archivo, import.meta.url));
}

for (const archivo of ["./agenteHandlers.ts", "./clientHandlers.ts"]) {
  Deno.test(`B-1: ${archivo} valida la re-invitación antes de invitar`, async () => {
    const src = await leer(archivo);
    assert(
      src.includes("validarReinvitacionPortal"),
      `${archivo} debe llamar validarReinvitacionPortal`,
    );
    // Los helpers `inviteOrLinkUser` / `createOrResetUserWithPassword` se
    // definen arriba en el archivo; sólo interesa el orden DENTRO del handler.
    const handler = src.slice(src.indexOf("export async function handleInvite"));
    const idxGuard = handler.indexOf("await validarReinvitacionPortal");
    const idxInvite = Math.min(
      ...["inviteOrLinkUser(", "createOrResetUserWithPassword(", "executeInvitePath("]
        .map((n) => handler.indexOf(`await ${n}`))
        .filter((i) => i >= 0),
    );
    assert(idxGuard > 0 && idxGuard < idxInvite, "el candado debe correr ANTES del invite");
  });
}

Deno.test("B-1: el candado rechaza cuentas con rol de staff", async () => {
  const src = await leer("./reinvitacion.ts");
  assert(src.includes("LC_CUENTA_NO_REINVITABLE"));
  assert(src.includes("organization_members"), "debe descartar cuentas con membresía de staff");
});
