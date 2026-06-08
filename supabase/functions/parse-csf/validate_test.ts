// @ts-nocheck — Deno runtime
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateFile } from "./validate.ts";

function makeFile(size: number, type = "application/pdf"): File {
  return new File([new Uint8Array(size)], "csf.pdf", { type });
}

Deno.test("validateFile: null → mensaje", () => {
  assertEquals(validateFile(null), "No se envió archivo PDF");
});
Deno.test("validateFile: tipo no-PDF → rechazado", () => {
  assertEquals(validateFile(makeFile(100, "image/png")), "Solo se aceptan archivos PDF");
});
Deno.test("validateFile: >5MB → rechazado", () => {
  assertEquals(validateFile(makeFile(6 * 1024 * 1024)), "El archivo excede el límite de 5 MB");
});
Deno.test("validateFile: PDF válido → null", () => {
  assertEquals(validateFile(makeFile(1024)), null);
});
