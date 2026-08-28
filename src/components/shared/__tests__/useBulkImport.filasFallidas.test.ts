import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBulkImport } from "../useBulkImport";

/**
 * L3 — cuando la importación masiva se corta a la mitad, el mensaje debe decir
 * exactamente qué filas del CSV faltaron, no sólo un conteo.
 */
describe("useBulkImport · detalle de filas fallidas (L3)", () => {
  const preview = {
    valid: [
      { rowNumber: 2, payload: { a: 1 } },
      { rowNumber: 3, payload: { a: 2 } },
      { rowNumber: 4, payload: { a: 3 } },
    ],
    invalid: [],
  };

  it("nombra el rango de filas que no se guardaron", async () => {
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

    expect(result.current.error).toContain("Se guardaron 1 de 3");
    expect(result.current.error).toContain("filas 3 a 4");
    expect(result.current.parcialCount).toBe(1);
  });
});
