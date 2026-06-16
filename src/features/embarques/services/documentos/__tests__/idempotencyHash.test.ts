/**
 * Tests para los helpers de hashing usados por el upload idempotente de
 * documentos de embarque. Verifican determinismo, formato UUID v4-like
 * y estabilidad ante el mismo contenido.
 */
import { describe, it, expect } from "vitest";
import { sha256Hex, hexToUuid } from "../idempotencyHash";

describe("sha256Hex", () => {
  it("devuelve 64 hex chars en minúsculas", async () => {
    const file = new File(["hola mundo"], "test.txt", { type: "text/plain" });
    const hex = await sha256Hex(file);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("es determinístico: mismo contenido → mismo hash", async () => {
    const a = new File(["contenido idéntico"], "a.txt");
    const b = new File(["contenido idéntico"], "b-renombrado.txt");
    expect(await sha256Hex(a)).toBe(await sha256Hex(b));
  });

  it("contenido distinto → hash distinto", async () => {
    const a = new File(["uno"], "a.txt");
    const b = new File(["dos"], "b.txt");
    expect(await sha256Hex(a)).not.toBe(await sha256Hex(b));
  });

  it("archivo vacío produce el hash SHA-256 vacío conocido", async () => {
    const empty = new File([], "vacio.txt");
    expect(await sha256Hex(empty)).toBe(
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
