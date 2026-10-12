import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import type { TablesInsert } from "@/integrations/supabase/types";
import { createClientesLote } from "@/features/cliente/services/importLote";
import { mapClienteRows } from "@/lib/csv/importSchemaCliente";
import { mapProveedorRows } from "@/lib/csv/importSchemaProveedor";
import { insertProveedoresLote } from "@/features/proveedor/services/importLote";
import { PreviewStep } from "../BulkImportSteps";
import { useBulkImport } from "../useBulkImport";

type ClienteInsert = TablesInsert<"clientes">;
const transport = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), is: vi.fn(), in: vi.fn(), rpc: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: transport }));

let persisted: ClienteInsert[];
let failAt: number;
let writes: number;

beforeEach(() => {
  Object.values(transport).forEach((mock) => mock.mockReset());
  persisted = [];
  failAt = 2;
  writes = 0;
  const query = { select: transport.select, is: transport.is, in: transport.in };
  transport.from.mockReturnValue(query);
  transport.select.mockReturnValue(query);
  transport.is.mockReturnValue(query);
  transport.in.mockImplementation(async (column: "nombre" | "rfc", values: string[]) => ({
    data: persisted.filter((row) => values.includes(row[column] ?? "")), error: null,
  }));
  transport.rpc.mockImplementation(async (_name: string, args: { p_clientes: ClienteInsert[] }) => {
    writes += 1;
    if (writes === failAt) return { data: null, error: { message: "Fallo simulado" } };
    const data = args.p_clientes.map((row, index) => ({ ...row, id: `alta-${writes}-${index}` }));
    persisted.push(...data);
    return { data, error: null };
  });
});

function cliente(index: number, withRfc = true): ClienteInsert {
  return {
    nombre: `CLIENTE ${String(index).padStart(3, "0")}`,
    rfc: withRfc ? `TST${String(index).padStart(9, "0")}` : "",
    email: `cliente${index}@example.invalid`,
  };
}

async function setup(rows: ClienteInsert[]) {
  const csv = ["nombre,rfc,email", ...rows.map((row) =>
    `${row.nombre},${row.rfc ?? ""},${row.email}`)].join("\n");
  const file = new File([csv], "clientes.csv", { type: "text/csv" });
  // Supply only jsdom's missing File API; the real reader, parser and mapper run.
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode(csv).buffer,
  });
  const onSuccess = vi.fn();
  const hook = renderHook(() => useBulkImport<ClienteInsert>({
    mapRows: (raw) => mapClienteRows(raw, "org-test"),
    onCommit: async (payloads, onProgress) => {
      const { creados, omitidos } = await createClientesLote(payloads, onProgress);
      return { creados: creados.length, omitidos };
    },
    onSuccess,
  }));
  await act(async () => { await hook.result.current.handleFile(file); });
  expect(hook.result.current.preview?.invalid).toEqual([]);
  expect(hook.result.current.preview?.valid).toHaveLength(rows.length);
  return { ...hook, onSuccess, file };
}

const cases = ["RFC existente", "nombre existente", "RFC interno", "nombre interno"].flatMap((identity) =>
  [{ position: "inicial", at: 0 }, { position: "intercalado", at: 101 }, { position: "final", at: 201 }]
    .map((position) => ({ identity, ...position })));

describe("useBulkImport con el servicio real de clientes y transporte en memoria", () => {
  it.each(cases)("omite duplicado $identity $position y reintenta sólo el alta restante", async ({ identity, at }) => {
    const rows = Array.from({ length: 201 }, (_, index) => cliente(index + 1, identity.startsWith("RFC")));
    const existing = identity.endsWith("existente");
    const duplicate = existing
      ? { nombre: "EXISTENTE", rfc: identity.startsWith("RFC") ? "EXISTENTE01" : "", email: "existente@example.invalid" }
      : { ...rows[0] };
    if (existing) persisted.push(duplicate);
    rows.splice(at, 0, duplicate);
    const { result, onSuccess } = await setup(rows);
    const preview = result.current.preview;

    await act(async () => { await result.current.handleCommit(); });
    const failureMessage = result.current.error;
    expect(result.current.step).toBe("preview");
    expect(result.current.preview).toBe(preview);
    expect(result.current.parcialCount).toBe(200);
    expect(persisted).toHaveLength(existing ? 201 : 200);
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith(200);
    expect(transport.rpc).toHaveBeenNthCalledWith(1, "crear_clientes", {
      p_clientes: rows.filter((row) => row.nombre !== "EXISTENTE")
        .filter((row, index, all) => all.findIndex((other) => other.nombre === row.nombre) === index)
        .slice(0, 200).map((row) => expect.objectContaining(row)),
    });
    expect(transport.rpc).toHaveBeenNthCalledWith(2, "crear_clientes", {
      p_clientes: [expect.objectContaining(cliente(201, identity.startsWith("RFC")))],
    });

    // Normal retry uses the unchanged preview of the same file. The service
    // re-queries persisted identities and sends only the one unconfirmed row.
    await act(async () => { await result.current.handleCommit(); });
    expect(transport.rpc).toHaveBeenCalledTimes(3);
    expect(transport.rpc).toHaveBeenNthCalledWith(3, "crear_clientes", {
      p_clientes: [expect.objectContaining(cliente(201, identity.startsWith("RFC")))],
    });
    expect(persisted).toHaveLength(existing ? 202 : 201);
    expect(new Set(persisted.map((row) => row.nombre)).size).toBe(persisted.length);
    expect(result.current.step).toBe("done");
    expect(result.current.error).toBeNull();
    expect(result.current.insertedCount).toBe(1);
    expect(result.current.omitidosCount).toBe(201);
    expect(result.current.parcialCount).toBe(1);
    expect(onSuccess.mock.calls).toEqual([[200], [1]]);
    expect(failureMessage).toBe(
      "Se importaron 200 de 201 clientes; el siguiente lote falló: Fallo simulado Altas confirmadas en este intento: 200.",
    );
  });

  it("conserva el control sin duplicados: 200 altas y reintento de una", async () => {
    const rows = Array.from({ length: 201 }, (_, index) => cliente(index + 1));
    const { result, onSuccess } = await setup(rows);
    await act(async () => { await result.current.handleCommit(); });
    const failureMessage = result.current.error;
    expect(result.current.parcialCount).toBe(200);
    expect(persisted).toHaveLength(200);
    await act(async () => { await result.current.handleCommit(); });
    expect(transport.rpc).toHaveBeenCalledTimes(3);
    expect(transport.rpc).toHaveBeenNthCalledWith(3, "crear_clientes", {
      p_clientes: [expect.objectContaining(cliente(201))],
    });
    expect(result.current.insertedCount).toBe(1);
    expect(result.current.omitidosCount).toBe(200);
    expect(onSuccess.mock.calls).toEqual([[200], [1]]);
    expect(failureMessage).toBe(
      "Se importaron 200 de 201 clientes; el siguiente lote falló: Fallo simulado Altas confirmadas en este intento: 200.",
    );
  });

  it("informa cero altas confirmadas cuando falla el primer lote y reinicia el contador al reintentar", async () => {
    failAt = 1;
    const { result, onSuccess } = await setup([cliente(1)]);
    await act(async () => { await result.current.handleCommit(); });
    const failureMessage = result.current.error;
    expect(result.current.step).toBe("preview");
    expect(result.current.parcialCount).toBe(0);
    expect(persisted).toEqual([]);
    expect(onSuccess).not.toHaveBeenCalled();
    await act(async () => { await result.current.handleCommit(); });
    expect(result.current.insertedCount).toBe(1);
    expect(result.current.omitidosCount).toBe(0);
    expect(result.current.parcialCount).toBe(1);
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith(1);
    expect(failureMessage).toBe(
      "Se importaron 0 de 1 clientes; el siguiente lote falló: Fallo simulado Altas confirmadas en este intento: 0.",
    );
  });

  it("la ayuda permite reintentar el mismo archivo y limita la omisión a duplicados detectados", () => {
    render(<PreviewStep fileName="clientes.csv" preview={{
      valid: Array.from({ length: 202 }, (_, index) => ({ rowNumber: index + 2, payload: cliente(index + 1) })),
      invalid: [],
    }} error="Fallo simulado" parcialCount={200} onReset={vi.fn()} />);
    const help = screen.getByText(/Altas confirmadas en este intento: 200/);
    expect(help).toHaveTextContent("Puedes reintentar con el mismo archivo");
    expect(help).toHaveTextContent("duplicados detectados por RFC o razón social");
    expect(help).not.toHaveTextContent(/200 de 202|filas restantes|no duplicar/i);
  });

  it("conserva el límite de proveedores: fallback 23505 puede guardar una fila sin confirmar progreso", async () => {
    type ProveedorInsert = TablesInsert<"proveedores">;
    const supplierCreated: ProveedorInsert[] = [];
    let singleWrites = 0;
    transport.from.mockImplementation((table: string) => {
      expect(table).toBe("proveedores");
      return {
        select: () => ({ is: () => ({ in: async () => ({ data: [], error: null }) }) }),
        insert: (payload: ProveedorInsert | ProveedorInsert[]) => Array.isArray(payload)
          ? { select: async () => ({ data: null, error: { code: "23505", message: "Conflicto simulado" } }) }
          : { select: () => ({ single: async () => {
            singleWrites += 1;
            if (singleWrites === 2) return { data: null, error: { message: "Fallo segunda fila" } };
            const data = { ...payload, id: "proveedor-1" };
            supplierCreated.push(data);
            return { data, error: null };
          } }) },
      };
    });
    const csv = "nombre,tipo,rfc\nPROVEEDOR UNO,Naviera,UNO\nPROVEEDOR DOS,Naviera,DOS";
    const file = new File([csv], "proveedores.csv", { type: "text/csv" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode(csv).buffer,
    });
    const onProgress = vi.fn();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useBulkImport<ProveedorInsert>({
      mapRows: (raw) => mapProveedorRows(raw, "org-test"),
      onCommit: async (payloads, report) => {
        const { creados, omitidos } = await insertProveedoresLote(payloads, (count) => {
          onProgress(count);
          report?.(count);
        });
        return { creados: creados.length, omitidos };
      },
      onSuccess,
    }));
    await act(async () => { await result.current.handleFile(file); });
    expect(result.current.preview?.invalid).toEqual([]);
    await act(async () => { await result.current.handleCommit(); });
    expect(singleWrites).toBe(2);
    expect(supplierCreated).toHaveLength(1);
    expect(supplierCreated[0].nombre).toBe("PROVEEDOR UNO");
    expect(onProgress).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.step).toBe("preview");
    expect(result.current.parcialCount).toBe(0);
    expect(result.current.error).toBe("Error al importar. Altas confirmadas en este intento: 0.");
  });
});

