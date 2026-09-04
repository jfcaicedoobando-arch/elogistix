/**
 * Autocarga del buzón: un callback que devuelve `false` es FALLO visible
 * (antes se pintaba "listo" con el formulario vacío) y se puede reintentar
 * sin cerrar el diálogo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { parseCfdiXmlMock, descargarMock } = vi.hoisted(() => ({
  parseCfdiXmlMock: vi.fn(),
  descargarMock: vi.fn(),
}));

vi.mock("@/features/cxp/services", () => ({ parseCfdiXml: parseCfdiXmlMock }));
vi.mock("@/features/cxp/services/parsePdfInvoice", () => ({ parsePdfInvoice: vi.fn() }));
vi.mock("@/features/cxp/services/capturaEntrante", () => ({
  descargarArchivoEntranteComoFile: descargarMock,
}));
vi.mock("@/hooks/shared/useOrgActiva", () => ({ useOrgActiva: () => ({ organizationId: "org1" }) }));

import { useAutocargaEntrante } from "@/features/cxp/hooks/useAutocargaEntrante";

const ENTRANTE = {
  id: "doc-1", archivoPath: "org1/doc.xml", nombreArchivo: "doc.xml",
  xmlPath: "org1/doc.xml", xmlNombre: "doc.xml",
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  descargarMock.mockResolvedValue(new File(["<x/>"], "doc.xml"));
  parseCfdiXmlMock.mockResolvedValue({ ok: true });
});

function render(onCfdiParsed: (...a: never[]) => unknown) {
  return renderHook(() =>
    useAutocargaEntrante({
      entrante: ENTRANTE, abierto: true, categorias: [],
      onCfdiParsed: onCfdiParsed as never, onPdfParsed: vi.fn(),
    }),
  );
}

describe("useAutocargaEntrante", () => {
  it("callback false ⇒ estado error con mensaje", async () => {
    const { result } = render(vi.fn().mockResolvedValue(false));
    await waitFor(() => expect(result.current.estado).toBe("error"));
    expect(result.current.mensaje).toMatch(/No se pudieron aplicar/i);
  });

  it("reintentar vuelve a leer y puede terminar en listo", async () => {
    const cb = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = render(cb);
    await waitFor(() => expect(result.current.estado).toBe("error"));
    await act(async () => { result.current.reintentar(); });
    await waitFor(() => expect(result.current.estado).toBe("listo"));
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("no reintenta cuando ya quedó listo (idempotencia)", async () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    const { result } = render(cb);
    await waitFor(() => expect(result.current.estado).toBe("listo"));
    await act(async () => { result.current.reintentar(); });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
