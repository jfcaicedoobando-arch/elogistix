/**
 * Auditoría CRM — errores del detector de duplicados NO pueden verse como
 * "sin coincidencias":
 *  - Alta manual (AvisoLeadDuplicado): fallo RPC → alerta no bloqueante con
 *    reintento; cuando la consulta sí funciona se conserva el aviso de
 *    duplicado exacto.
 *  - CSV (useImportarLeadsCsv): fallo RPC → Importar bloqueado hasta reintentar
 *    con éxito; con revisión exitosa los duplicados exactos se omiten.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";

const duplicadoLead = vi.fn();
const duplicadosLote = vi.fn();
const mutateAsync = vi.hoisted(() => vi.fn());

vi.mock("@/features/crm/hooks/useLeadsDuplicados", () => ({
  useDuplicadoLead: (clave: unknown, habilitado?: boolean) => duplicadoLead(clave, habilitado),
  useDuplicadosLote: (filas: unknown) => duplicadosLote(filas),
}));
vi.mock("@/features/crm/hooks", () => ({
  useCrearLeadsBulk: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

import { AvisoLeadDuplicado } from "../AvisoLeadDuplicado";
import { useImportarLeadsCsv } from "../../hooks/useImportarLeadsCsv";

const loteOk = {
  coincidencias: [],
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  listo: true,
  refetch: vi.fn(),
  existentes: [],
};

beforeEach(() => {
  duplicadoLead.mockReset();
  duplicadosLote.mockReset();
  mutateAsync.mockReset();
  duplicadosLote.mockReturnValue(loteOk);
});

describe("AvisoLeadDuplicado — error RPC", () => {
  it("muestra alerta no bloqueante con reintento cuando falla la revisión", () => {
    const refetch = vi.fn();
    duplicadoLead.mockReturnValue({
      coincidencia: null, isLoading: false, isError: true, error: new Error("RLS"), refetch,
    });
    render(<AvisoLeadDuplicado empresa="Acme" email="" telefono="" />);
    expect(screen.getByText(/No pudimos comprobar duplicados/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("conserva el aviso de duplicado exacto cuando la consulta sí funciona", () => {
    duplicadoLead.mockReturnValue({
      coincidencia: {
        nivel: "exacto",
        campos: ["empresa"],
        existente: { empresa: "Acme SA", contacto: null, estado: "Nuevo" },
      },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    });
    render(<AvisoLeadDuplicado empresa="Acme SA" email="" telefono="" />);
    expect(screen.getByText(/Este prospecto ya existe/i)).toBeInTheDocument();
    expect(screen.queryByText(/No pudimos comprobar/i)).toBeNull();
  });

  it("sin coincidencias y sin error no muestra nada", () => {
    duplicadoLead.mockReturnValue({
      coincidencia: { nivel: "nuevo", campos: [], existente: null },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    });
    const { container } = render(<AvisoLeadDuplicado empresa="Nueva" email="" telefono="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("useImportarLeadsCsv — error RPC de duplicados", () => {
  function archivoCsv(): File {
    const u8 = new TextEncoder().encode("empresa,contacto\nAcme,Ana\n");
    const f = new File([u8], "leads.csv", { type: "text/csv" });
    if (typeof f.arrayBuffer !== "function") {
      (f as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
        u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
    }
    return f;
  }

  it("bloquea Importar y no llama la mutación mientras la revisión falló", async () => {
    const refetch = vi.fn();
    duplicadosLote.mockReturnValue({
      ...loteOk, listo: false, isError: true, error: new Error("red"), refetch,
    });
    const { result } = renderHook(() => useImportarLeadsCsv({ onDone: vi.fn() }));

    await act(async () => {
      await result.current.handleFile(archivoCsv());
    });

    expect(result.current.duplicadosError).toBe(true);
    expect(result.current.puedeImportar).toBe(false);
    await act(async () => {
      await result.current.handleImport();
    });
    expect(mutateAsync).not.toHaveBeenCalled();

    act(() => result.current.reintentarDuplicados());
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("con revisión exitosa omite duplicados exactos y permite importar", async () => {
    duplicadosLote.mockReturnValue({
      ...loteOk,
      coincidencias: [
        { nivel: "exacto", campos: ["empresa"], existente: { empresa: "Acme" } },
      ],
    });
    mutateAsync.mockResolvedValue({ affected: 0, aviso: null });
    const onDone = vi.fn();
    const { result } = renderHook(() => useImportarLeadsCsv({ onDone }));

    await act(async () => {
      await result.current.handleFile(archivoCsv());
    });

    expect(result.current.validRows).toHaveLength(0);
    expect(result.current.duplicadosCount).toBe(1);
    expect(result.current.puedeImportar).toBe(false); // 0 válidas: nada que importar
  });
});
