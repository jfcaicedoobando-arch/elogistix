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

// Sprint 4 D-18: cobertura 4xx-equivalente en boundary del límite de tamaño.
Deno.test("validateFile: exactamente 5 MB → aceptado (boundary inferior)", () => {
  assertEquals(validateFile(makeFile(5 * 1024 * 1024)), null);
});
Deno.test("validateFile: 5 MB + 1 byte → rechazado (boundary superior)", () => {
  assertEquals(
    validateFile(makeFile(5 * 1024 * 1024 + 1)),
    "El archivo excede el límite de 5 MB",
  );
});
Deno.test("validateFile: PDF 0 bytes → aceptado (no validamos contenido aquí)", () => {
  assertEquals(validateFile(makeFile(0)), null);
});

