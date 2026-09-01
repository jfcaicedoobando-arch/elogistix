/**
 * Invariante: la lista server-side `ROLES_ADJUNTAR_XML_ENTRANTE`
 * (`supabase/functions/_shared/auth.ts`) debe coincidir con la capacidad de UI
 * `ADJUNTAR_XML_FACTURA_ENTRANTE`. Si se separan, operaciones vuelve a recibir
 * 403 al subir el PDF+XML del agente desde la pestaña Costos del embarque.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADJUNTAR_XML_FACTURA_ENTRANTE } from "@/lib/access/permissionMatrix";

const AUTH_TS = "supabase/functions/_shared/auth.ts";

function rolesServidor(nombre: string): string[] {
  const src = readFileSync(AUTH_TS, "utf8");
  const re = new RegExp(`export const ${nombre}: readonly string\\[\\] = \\[([^\\]]*)\\]`);
  const m = re.exec(src);
  if (!m) throw new Error(`No se encontró ${nombre} en ${AUTH_TS}`);
  return [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
}

describe("ROLES_ADJUNTAR_XML_ENTRANTE (servidor) ↔ ADJUNTAR_XML_FACTURA_ENTRANTE (UI)", () => {
  it("contienen exactamente los mismos roles", () => {
    const servidor = rolesServidor("ROLES_ADJUNTAR_XML_ENTRANTE").sort();
    const ui = [...ADJUNTAR_XML_FACTURA_ENTRANTE].sort();
    expect(servidor).toEqual(ui);
  });

  it("incluye a los roles operativos que suben archivos al buzón", () => {
    const servidor = rolesServidor("ROLES_ADJUNTAR_XML_ENTRANTE");
    expect(servidor).toContain("operador");
    expect(servidor).toContain("coordinador_logistico");
  });
});
