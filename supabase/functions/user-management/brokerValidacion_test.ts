import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validarAltaBroker } from "./brokerValidacion.ts";

const base = { email: " Ana@Broker.mx ", nombre: "Ana", organization_id: "org", comision_pct: 10 };

Deno.test("normaliza correo y acepta % válido", () => {
  const r = validarAltaBroker(base);
  assertEquals(typeof r === "string" ? r : r.email, "ana@broker.mx");
});
Deno.test("rechaza % fuera de 0-100", () => {
  assertEquals(typeof validarAltaBroker({ ...base, comision_pct: 101 }), "string");
  assertEquals(typeof validarAltaBroker({ ...base, comision_pct: -1 }), "string");
});
Deno.test("rechaza correo inválido", () => {
  assertEquals(typeof validarAltaBroker({ ...base, email: "sin-arroba" }), "string");
});
