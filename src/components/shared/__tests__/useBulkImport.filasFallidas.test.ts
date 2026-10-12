import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBulkImport } from "../useBulkImport";

/**
 * Un conteo de altas confirmadas no permite inferir las filas pendientes.
 */
describe("useBulkImport · altas confirmadas", () => {
  const preview = {
    valid: [
      { rowNumber: 2, payload: { a: 1 } },
      { rowNumber: 3, payload: { a: 2 } },
      { rowNumber: 4, payload: { a: 3 } },
    ],
    invalid: [],
  };

  it("informa sólo el conteo confirmado del intento", async () => {
    const { result } = renderHook(() =>
      useBulkImport<{ a: number }>({
        mapRows: () => preview,
        onCommit: async (_p, reportar) => {
          reportar?.(1);
          throw new Error("Falló el lote.");
        },
      }),
    );

    await act(async () => {
      await result.current.handleFile(
        new File(["a\n1\n2\n3\n"], "datos.csv", { type: "text/csv" }),
      );
    });
    await act(async () => {
      await result.current.handleCommit();
    });

    expect(result.current.error).toBe("Falló el lote. Altas confirmadas en este intento: 1.");
    expect(result.current.parcialCount).toBe(1);
  });
});
