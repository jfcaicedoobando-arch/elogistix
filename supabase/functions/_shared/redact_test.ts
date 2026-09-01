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

/**
 * v13.823.2: las edges de cola propia (`send-transactional-email`,
 * `handle-email-unsubscribe`) se retiraron al migrar a la entrega administrada
 * de Lovable. La guarda ahora cubre el pipeline vigente: ninguna llamada a
 * `console.*` puede pasar un correo crudo; si aparece, debe ir por `maskEmail(`.
 */
const EDGES_CORREO = [
  "./enviarEmailPlantilla.ts",
  "./emailSendLog.ts",
  "../handle-email-events/index.ts",
];

/** Devuelve el texto de cada llamada `console.x(...)` con paréntesis balanceados. */
function llamadasConsole(src: string): string[] {
  const salida: string[] = [];
  const re = /console\.\w+\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    let i = m.index + m[0].length;
    let nivel = 1;
    while (i < src.length && nivel > 0) {
      if (src[i] === "(") nivel++;
      else if (src[i] === ")") nivel--;
      i++;
    }
    salida.push(src.slice(m.index, i));
  }
  return salida;
}

Deno.test("PII: los logs de las edges de correo no exponen correos crudos", async () => {
  const leer = (a: string) => Deno.readTextFile(new URL(a, import.meta.url));
  for (const archivo of EDGES_CORREO) {
    const src = await leer(archivo);
    for (const llamada of llamadasConsole(src)) {
      const sospechosa = /\b(email|recipient|recipientEmail|destinatario)\b\s*[,:}]/.test(llamada);
      assert(
        !sospechosa || llamada.includes("maskEmail("),
        `log sin enmascarar en ${archivo}: ${llamada.replace(/\s+/g, " ").slice(0, 160)}`,
      );
    }
  }
});
