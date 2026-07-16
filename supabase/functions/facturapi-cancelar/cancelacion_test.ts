import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  enrichCancelacionErrorMessage,
} from "./cancelacion.ts";

Deno.test("enrichCancelacionErrorMessage: detecta SAT caído (transient=true)", () => {
  const r = enrichCancelacionErrorMessage("El servicio de CancelacionSAT no esta disponible");
  assertEquals(r.transient, true);
  assertEquals(r.message.includes("SAT no está respondiendo"), true);
});

Deno.test("enrichCancelacionErrorMessage: detecta 'no cancelable' (transient=false)", () => {
  const r = enrichCancelacionErrorMessage("Esta factura está marcada como no cancelable por el SAT");
  assertEquals(r.transient, false);
  assertEquals(r.message.includes("Buzón Tributario"), true);
});

Deno.test("enrichCancelacionErrorMessage: mensaje genérico se preserva", () => {
  const r = enrichCancelacionErrorMessage("Otro error inesperado");
  assertEquals(r.transient, false);
  assertEquals(r.message, "Otro error inesperado");
});
