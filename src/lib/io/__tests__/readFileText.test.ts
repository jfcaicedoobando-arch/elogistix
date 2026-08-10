/**
 * N34 (Ola 4): fallback UTF-8 → Windows-1252 en la lectura de archivos CSV.
 */
import { describe, it, expect } from "vitest";
import { leerArchivoTexto } from "../readFileText";

function fileDesdeBytes(bytes: number[], name = "test.csv"): File {
  const u8 = new Uint8Array(bytes);
  const f = new File([u8], name, { type: "text/csv" });
  if (typeof f.arrayBuffer !== "function") {
    (f as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
      u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  }
  return f;
}

describe("leerArchivoTexto", () => {
  it("decodifica UTF-8 con acentos sin tocar el fallback", async () => {
    const bytes = Array.from(new TextEncoder().encode("DESCRIPCIÓN,SEÑORA"));
    expect(await leerArchivoTexto(fileDesdeBytes(bytes, "utf8.csv"))).toBe("DESCRIPCIÓN,SEÑORA");
  });

  it("cae a Windows-1252 cuando el UTF-8 es inválido (0xD3 = Ó, 0xD1 = Ñ)", async () => {
    const bytes = [
      0x44, 0x45, 0x53, 0x43, 0x52, 0x49, 0x50, 0x43, 0x49, 0xd3, 0x4e, 0x2c,
      0x53, 0x45, 0xd1, 0x4f, 0x52, 0x41,
    ];
    expect(await leerArchivoTexto(fileDesdeBytes(bytes))).toBe("DESCRIPCIÓN,SEÑORA");
  });

  it("ASCII puro decodifica igual por ambos caminos", async () => {
    expect(await leerArchivoTexto(fileDesdeBytes([0x41, 0x42, 0x43]))).toBe("ABC");
  });
});
