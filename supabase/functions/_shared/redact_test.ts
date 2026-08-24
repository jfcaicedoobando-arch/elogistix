/**
 * R3 · P3 — maskEmail: los correos completos (PII) no van a logs.
 *
 * Run: deno test --no-check supabase/functions/_shared/redact_test.ts
 */
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { maskEmail, maskEmailsInText } from "./redact.ts";

Deno.test("maskEmail: conserva inicial y dominio, oculta el local-part", () => {
  assertEquals(maskEmail("juan.perez@ejemplo.com"), "j***@ejemplo.com");
  assertEquals(maskEmail("a@b.co"), "a***@b.co");
});

Deno.test("maskEmail: entradas degeneradas no exponen nada", () => {
  assertEquals(maskEmail(""), "(sin-email)");
  assertEquals(maskEmail(null), "(sin-email)");
  assertEquals(maskEmail(undefined), "(sin-email)");
  assertEquals(maskEmail("sin-arroba"), "***");
  assertEquals(maskEmail("@dominio.com"), "***");
});

Deno.test("maskEmailsInText: enmascara correos incrustados en texto libre", () => {
  const out = maskEmailsInText("falló el envío a cliente.final@empresa.mx (SMTP 550)");
  assertEquals(out, "falló el envío a c***@empresa.mx (SMTP 550)");
});

Deno.test("PII: los logs de las edges de correo pasan por maskEmail", async () => {
  const leer = (a: string) => Deno.readTextFile(new URL(a, import.meta.url));
  for (
    const archivo of [
      "../send-transactional-email/index.ts",
      "../send-transactional-email/unsubscribeToken.ts",
      "../handle-email-unsubscribe/index.ts",
    ]
  ) {
    const src = await leer(archivo);
    assertStringIncludes(src, "maskEmail(");
    const logs = src.split("\n").filter((l) => l.includes("console."));
    for (const linea of logs) {
      assert(
        !/email: (normalizedEmail|tokenRecord\.email)/.test(linea) &&
          !linea.includes("effectiveRecipient: meta.effectiveRecipient") &&
          !linea.includes("templateName, effectiveRecipient }"),
        `log sin enmascarar en ${archivo}: ${linea.trim()}`,
      );
    }
  }
});
