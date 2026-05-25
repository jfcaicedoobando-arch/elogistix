import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportToCsv } from "@/generators/exportCsv";

const blobs: Blob[] = [];
let lastClicked: { href: string; download: string } | null = null;

beforeEach(() => {
  blobs.length = 0;
  lastClicked = null;
  globalThis.URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b);
    return `blob:${blobs.length}`;
  }) as unknown as typeof URL.createObjectURL;
  globalThis.URL.revokeObjectURL = vi.fn();

  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag === "a") {
      const a = {
        href: "",
        download: "",
        click() {
          lastClicked = { href: a.href, download: a.download };
        },
      };
      return a as unknown as HTMLElement;
    }
    return document.createElement.call(document, tag);
  }) as never);
});

async function readCsv(): Promise<string> {
  return await blobs[0].text();
}

describe("exportToCsv", () => {
  const headers = [
    { key: "nombre", label: "Nombre" },
    { key: "monto", label: "Monto" },
  ];

  it("genera header + filas con BOM UTF-8", async () => {
    exportToCsv("test.csv", headers, [{ nombre: "ACME", monto: 100 }]);
    const csv = await readCsv();
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Nombre,Monto");
    expect(csv).toContain("ACME,100");
  });

  it("escapa comas, comillas y saltos de línea", async () => {
    exportToCsv("t.csv", [{ key: "v", label: "V" }], [
      { v: "a,b" }, { v: 'con "quote"' }, { v: "linea\n2" },
    ]);
    const csv = await readCsv();
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"con ""quote"""');
    expect(csv).toContain('"linea\n2"');
  });

  it("trata null/undefined como string vacío", async () => {
    exportToCsv("t.csv", headers, [{ nombre: null, monto: undefined }]);
    const csv = await readCsv();
    expect(csv.split("\n")[1]).toBe(",");
  });

  it("dispara click con el filename correcto", () => {
    exportToCsv("reporte-2026.csv", headers, []);
    expect(lastClicked?.download).toBe("reporte-2026.csv");
  });
});
