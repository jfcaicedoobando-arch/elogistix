/**
 * Tests para los helpers de hashing usados por el upload idempotente de
 * documentos de embarque. Verifican determinismo, formato UUID v4-like
 * y estabilidad ante el mismo contenido.
 */
import { describe, it, expect } from "vitest";
import { sha256Hex, hexToUuid } from "../idempotencyHash";

// jsdom no implementa File.arrayBuffer/stream funcional; construimos un File
// "real" + override de arrayBuffer con el buffer ya conocido.
function makeFile(content: string, name = "f.txt"): File {
  const file = new File([content], name);
  const bytes = new TextEncoder().encode(content);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(buffer),
    configurable: true,
  });
  return file;
}

describe("sha256Hex", () => {
  it("devuelve 64 hex chars en minúsculas", async () => {
    const hex = await sha256Hex(makeFile("hola mundo"));
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("es determinístico: mismo contenido → mismo hash", async () => {
    const a = await sha256Hex(makeFile("contenido idéntico", "a.txt"));
    const b = await sha256Hex(makeFile("contenido idéntico", "b.txt"));
    expect(a).toBe(b);
  });

  it("contenido distinto → hash distinto", async () => {
    const a = await sha256Hex(makeFile("uno"));
    const b = await sha256Hex(makeFile("dos"));
    expect(a).not.toBe(b);
  });

  it("archivo vacío produce el hash SHA-256 vacío conocido", async () => {
    expect(await sha256Hex(makeFile(""))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("hexToUuid", () => {
  it("formatea 32 hex chars con guiones UUID v4-like", () => {
    const hex = "0123456789abcdef0123456789abcdef";
    expect(hexToUuid(hex)).toBe("01234567-89ab-cdef-0123-456789abcdef");
  });

  it("trunca hex >32 chars a los primeros 32", () => {
    const hex = "0123456789abcdef0123456789abcdefDESCARTAR";
    expect(hexToUuid(hex)).toBe("01234567-89ab-cdef-0123-456789abcdef");
  });

  it("determinístico: mismo hex → mismo UUID", () => {
    const hex = "ffffffffffffffffffffffffffffffff";
    expect(hexToUuid(hex)).toBe(hexToUuid(hex));
  });
});
