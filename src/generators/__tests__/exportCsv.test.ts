import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock centralizado: aislamos el test del DOM y del helper de descarga real.
const descargarBlobSpy = vi.fn<(blob: Blob, name: string) => void>();
vi.mock("@/lib/downloadBlob", () => ({
  descargarBlob: (blob: Blob, name: string) => descargarBlobSpy(blob, name),
}));

import { exportToCsv } from "@/generators/exportCsv";

beforeEach(() => {
  descargarBlobSpy.mockReset();
});

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsText(blob, "utf-8");
  });
}

describe("exportToCsv", () => {
  const headers = [
    { key: "nombre", label: "Nombre" },
    { key: "monto", label: "Monto" },
  ];

  it("genera header + filas (con BOM UTF-8 en el blob)", async () => {
    exportToCsv("test.csv", headers, [{ nombre: "ACME", monto: 100 }]);
    expect(descargarBlobSpy).toHaveBeenCalledTimes(1);
    const [blob] = descargarBlobSpy.mock.calls[0];
    expect(blob.size).toBeGreaterThan(0);
    const csv = await readBlobText(blob);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Nombre,Monto");
    expect(csv).toContain("ACME,100");
  });

  it("escapa comas, comillas y saltos de línea", async () => {
    exportToCsv("t.csv", [{ key: "v", label: "V" }], [
      { v: "a,b" },
      { v: 'con "quote"' },
      { v: "linea\n2" },
    ]);
    const [blob] = descargarBlobSpy.mock.calls[0];
    const csv = await readBlobText(blob);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"con ""quote"""');
    expect(csv).toContain('"linea\n2"');
  });

  it("trata null/undefined como string vacío", async () => {
    exportToCsv("t.csv", headers, [{ nombre: null, monto: undefined }]);
    const [blob] = descargarBlobSpy.mock.calls[0];
    const csv = await readBlobText(blob);
    expect(csv.split("\n")[1]).toBe(",");
  });

  it("dispara descarga con el filename correcto", () => {
    exportToCsv("reporte-2026.csv", headers, []);
    expect(descargarBlobSpy).toHaveBeenCalledWith(expect.any(Blob), "reporte-2026.csv");
  });
});
