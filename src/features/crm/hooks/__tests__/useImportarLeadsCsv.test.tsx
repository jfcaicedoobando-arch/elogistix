/**
 * Ola 5 · N34: el importador de leads lee el CSV con fallback de encoding
 * (UTF-8 fatal → windows-1252). Antes file.text() producía mojibake con
 * exports de Excel en Windows es-MX.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mutateAsync = vi.hoisted(() => vi.fn());

vi.mock("@/features/crm/hooks", () => ({
  useCrearLeadsBulk: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("@/features/crm/hooks/useLeadsDuplicados", () => ({
  useDuplicadosLote: () => ({
    coincidencias: [],
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    listo: true,
    refetch: vi.fn(),
    existentes: [],
  }),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

import { useImportarLeadsCsv } from "../useImportarLeadsCsv";

/** Codifica un string a bytes Windows-1252 (ASCII + mapa mínimo de acentos). */
function bytes1252(texto: string): number[] {
  const mapa: Record<string, number> = { ñ: 0xf1, é: 0xe9, á: 0xe1, í: 0xed, ó: 0xf3, ú: 0xfa };
  return Array.from(texto, (ch) => {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) return code;
    const byte = mapa[ch];
    if (byte === undefined) throw new Error(`Fixture sin byte 1252 para ${ch}`);
    return byte;
  });
}

function archivoDesdeBytes(bytes: number[], name = "leads.csv"): File {
  const u8 = new Uint8Array(bytes);
  const f = new File([u8], name, { type: "text/csv" });
  // jsdom no implementa Blob.prototype.arrayBuffer(); polyfill puntual
  // (mismo patrón que src/lib/io/__tests__/readFileText.test.ts).
  if (typeof f.arrayBuffer !== "function") {
    (f as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
      u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  }
  return f;
}

describe("useImportarLeadsCsv (Ola 5 · N34)", () => {
  it("importa un CSV Windows-1252 sin mojibake (ñ = 0xF1, é = 0xE9)", async () => {
    const bytes = bytes1252("empresa,contacto\nDiseños Peña,José\n");
    const { result } = renderHook(() => useImportarLeadsCsv({ onDone: vi.fn() }));

    await act(async () => {
      await result.current.handleFile(archivoDesdeBytes(bytes));
    });

    expect(result.current.errorCount).toBe(0);
    expect(result.current.validRows).toHaveLength(1);
    expect(result.current.validRows[0].empresa).toBe("Diseños Peña");
    expect(result.current.validRows[0].contacto).toBe("José");
  });

  it("sigue leyendo correctamente un CSV UTF-8 con acentos", async () => {
    const u8 = new TextEncoder().encode("empresa,contacto\nDiseños Peña,José\n");
    const { result } = renderHook(() => useImportarLeadsCsv({ onDone: vi.fn() }));

    await act(async () => {
      await result.current.handleFile(archivoDesdeBytes(Array.from(u8), "utf8.csv"));
    });

    expect(result.current.validRows).toHaveLength(1);
    expect(result.current.validRows[0].empresa).toBe("Diseños Peña");
  });
});
