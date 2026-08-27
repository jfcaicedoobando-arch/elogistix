/**
 * R2 · W-11 — el envío debe reclamarse atómicamente ANTES de llamar al
 * proveedor; si no, dos corridas traslapadas del cron mandan el mismo correo.
 */
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("W-11: claimSendAtomico corre antes de sendLovableEmail", async () => {
  const src = await Deno.readTextFile(new URL("./processItem.ts", import.meta.url));
  const idxClaim = src.indexOf("await claimSendAtomico(");
  const idxSend = src.indexOf("await sendLovableEmail(");
  assert(idxClaim > 0, "debe reclamar el envío");
  assert(idxSend > 0, "debe existir el envío");
  assert(idxClaim < idxSend, "el claim debe correr antes del envío");
});

Deno.test("W-11: el claim es un UPDATE condicionado a estado no final", async () => {
  const src = await Deno.readTextFile(new URL("./processItem.ts", import.meta.url));
  assert(src.includes(".not('status', 'in', '(\"sent\",\"dlq\")')"), "debe excluir estados finales");
  assert(src.includes("if (!claimed) return { status: 'duplicate' }"), "sin claim debe abortar");
});
