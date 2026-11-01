import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { mapClienteRows } from "@/lib/csv/importSchemaCliente";
import { IMPORT_MAX_BYTES, IMPORT_MAX_FILAS } from "@/lib/csv/importLimits";
import { useBulkImport } from "../useBulkImport";

const readFile = vi.hoisted(() => vi.fn<(file: File) => Promise<string>>());
vi.mock("@/lib/io/readFileText", () => ({ leerArchivoTexto: readFile }));

beforeEach(() => readFile.mockReset());

function setup() {
  const mapRows = vi.fn((rows: Record<string, string>[]) => mapClienteRows(rows, "org-test"));
  const onCommit = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() => useBulkImport({ mapRows, onCommit }));
  const load = async (csv: string) => {
    readFile.mockResolvedValue(csv);
    await act(async () => {
      await hook.result.current.handleFile(new File([csv], "clientes.csv", { type: "text/csv" }));
    });
  };
  return { ...hook, mapRows, onCommit, load };
}

describe("preflight CSV antes de mapear o importar", () => {
  it.each([
    ['nombre,email\nAcme,"sin cerrar', "comillas sin cerrar"],
    ['nombre,email\nAcme, "a,b@ejemplo.mx"', "espacios antes de las comillas"],
  ])("muestra error de sintaxis sin importar datos parciales: %s", async (csv, message) => {
    const { result, load, mapRows, onCommit } = setup();
    await load(csv);
    expect(result.current.error).toContain(message);
    expect(result.current.step).toBe("upload");
    expect(result.current.preview).toBeNull();
    expect(mapRows).not.toHaveBeenCalled();
    await act(async () => { await result.current.handleCommit(); });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("mantiene el límite de filas antes del mapeo de dominio", async () => {
    const { result, load, mapRows } = setup();
    await load("nombre,email\n" + Array.from(
      { length: IMPORT_MAX_FILAS + 1 }, (_, i) => `Cliente ${i},cliente${i}@ejemplo.mx`,
    ).join("\n"));
    expect(result.current.error).toContain("1001 filas");
    expect(result.current.preview).toBeNull();
    expect(mapRows).not.toHaveBeenCalled();
  });

  it("mantiene el límite de tamaño antes de leer el archivo", async () => {
    const { result, load, mapRows } = setup();
    await load("x".repeat(IMPORT_MAX_BYTES + 1));
    expect(result.current.error).toContain("el máximo es 2 MB");
    expect(readFile).not.toHaveBeenCalled();
    expect(mapRows).not.toHaveBeenCalled();
  });
});
