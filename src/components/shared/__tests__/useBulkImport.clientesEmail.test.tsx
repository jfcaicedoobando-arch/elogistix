import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import type { TablesInsert } from "@/integrations/supabase/types";
import { mapClienteRows } from "@/lib/csv/importSchemaCliente";
import { createClientesLote } from "@/features/cliente/services/importLote";
import { BulkImportFooter } from "../BulkImportDialogParts";
import { PreviewStep } from "../BulkImportSteps";
import { useBulkImport } from "../useBulkImport";

type ClienteInsert = TablesInsert<"clientes">;

const mocks = vi.hoisted(() => ({
  readFile: vi.fn<(file: File) => Promise<string>>(),
  from: vi.fn(),
  select: vi.fn(),
  is: vi.fn(),
  in: vi.fn(),
  rpc: vi.fn(),
}));

// Only the file reader and transport are stubbed: parser, mapper, hook and
// canonical import service run together without any network or database I/O.
vi.mock("@/lib/io/readFileText", () => ({ leerArchivoTexto: mocks.readFile }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  const query = { select: mocks.select, is: mocks.is, in: mocks.in };
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.is.mockReturnValue(query);
  mocks.in.mockResolvedValue({ data: [], error: null });
  mocks.rpc.mockImplementation(async (_name: string, args: { p_clientes: ClienteInsert[] }) => ({
    data: args.p_clientes.map((cliente, index) => ({ ...cliente, id: `nuevo-${index}` })),
    error: null,
  }));
});

function setup(csv: string) {
  mocks.readFile.mockResolvedValue(csv);
  const onSuccess = vi.fn();
  const onCommit = vi.fn(async (
    payloads: ClienteInsert[], reportarProgreso?: (insertados: number) => void,
  ) => {
    const { creados, omitidos } = await createClientesLote(payloads, reportarProgreso);
    return { creados: creados.length, omitidos };
  });
  const hook = renderHook(() => useBulkImport<ClienteInsert>({
    mapRows: (rows) => mapClienteRows(rows, "org-test"), onCommit, onSuccess,
  }));
  const load = async () => {
    await act(async () => {
      await hook.result.current.handleFile(new File([csv], "clientes.csv", { type: "text/csv" }));
    });
  };
  return { ...hook, onCommit, onSuccess, load };
}

describe("client CSV email preflight through commit", () => {
  it("shows all six missing emails by row and prevents import before any transport call", async () => {
    const csv = "nombre,rfc,email\n" + Array.from(
      { length: 6 }, (_, index) => `CLIENTE ${index + 1},,`,
    ).join("\n");
    const { result, load, onCommit, onSuccess } = setup(csv);
    await load();

    const { preview } = result.current;
    expect(result.current.step).toBe("preview");
    expect(preview?.valid).toHaveLength(0);
    expect(preview?.invalid.map(({ rowNumber }) => rowNumber)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(preview?.invalid.every(({ message }) => message.includes("Correo: requerido."))).toBe(true);
    expect(preview).not.toBeNull();
    if (!preview) throw new Error("Expected CSV preview");
    render(<>
      <PreviewStep fileName="clientes.csv" preview={preview} error={null} onReset={vi.fn()} />
      <BulkImportFooter step="preview" preview={preview} onReset={vi.fn()}
        onCommit={result.current.handleCommit} onClose={vi.fn()} />
    </>);
    expect(screen.getByText(/^0 v/)).toBeInTheDocument();
    expect(screen.getByText("6 con error")).toBeInTheDocument();
    for (const rowNumber of [2, 3, 4, 5, 6, 7]) {
      expect(screen.getByText(`Fila ${rowNumber}:`).closest("li"))
        .toHaveTextContent("Correo: requerido.");
    }
    expect(screen.getByRole("button", { name: /^Importar 0/ })).toBeDisabled();

    // Also exercise the hook guard directly; a disabled button alone is insufficient.
    await act(async () => { await result.current.handleCommit(); });
    expect(result.current.step).toBe("preview");
    expect(result.current.insertedCount).toBe(0);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("imports only trimmed valid emails and preserves RFC/name dedupe and real counts", async () => {
    const csv = [
      "nombre,rfc,email",
      "INVALIDO PRIMERO,,",
      "invalido primero,, primero@example.invalid ",
      "EXISTENTE RFC,AAA010101AAA,rfc@example.invalid",
      "existente nombre,,nombre@example.invalid",
      "NUEVO RFC,CCC010101AAA,compartido@example.invalid",
      "DUP RFC,ccc010101aaa,otro@example.invalid",
      "Nuevo Nombre,,nuevo@example.invalid",
      " nuevo   nombre ,,repetido@example.invalid",
      "OTRA IDENTIDAD,DDD010101AAA, compartido@example.invalid ",
      "EMAIL MALO,,sin-arroba",
      'ESPACIOS,,"   "',
    ].join("\n");
    mocks.in.mockImplementation(async (column: string) => ({
      data: column === "rfc"
        ? [{ nombre: "EXISTENTE RFC", rfc: "AAA010101AAA" }]
        : [{ nombre: "EXISTENTE NOMBRE", rfc: "BBB010101AAA" }],
      error: null,
    }));
    const { result, load, onCommit, onSuccess } = setup(csv);
    await load();

    expect(result.current.preview?.valid).toHaveLength(8);
    expect(result.current.preview?.invalid.map(({ rowNumber }) => rowNumber)).toEqual([2, 11, 12]);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    await act(async () => { await result.current.handleCommit(); });

    expect(onCommit).toHaveBeenCalledTimes(1);
    const accepted = onCommit.mock.calls[0][0];
    expect(accepted).toHaveLength(8);
    expect(accepted.every(({ email }) => email !== "" && email === email?.trim())).toBe(true);
    expect(accepted.some(({ nombre }) => nombre === "EMAIL MALO" || nombre === "ESPACIOS")).toBe(false);
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.from).toHaveBeenNthCalledWith(1, "clientes");
    expect(mocks.in).toHaveBeenNthCalledWith(1, "rfc", ["AAA010101AAA", "CCC010101AAA", "DDD010101AAA"]);
    expect(mocks.in).toHaveBeenNthCalledWith(2, "nombre", [
      "INVALIDO PRIMERO", "EXISTENTE RFC", "EXISTENTE NOMBRE", "NUEVO RFC",
      "DUP RFC", "NUEVO NOMBRE", "OTRA IDENTIDAD",
    ]);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("crear_clientes", {
      p_clientes: [
        expect.objectContaining({ nombre: "INVALIDO PRIMERO", email: "primero@example.invalid" }),
        expect.objectContaining({ nombre: "NUEVO RFC", email: "compartido@example.invalid" }),
        expect.objectContaining({ nombre: "NUEVO NOMBRE", email: "nuevo@example.invalid" }),
        expect.objectContaining({ nombre: "OTRA IDENTIDAD", email: "compartido@example.invalid" }),
      ],
    });
    expect(result.current.step).toBe("done");
    expect(result.current.insertedCount).toBe(4);
    expect(result.current.omitidosCount).toBe(4);
    expect(result.current.parcialCount).toBe(4);
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith(4);
  });
});
