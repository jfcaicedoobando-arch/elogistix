import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DocumentoProveedor } from "@/features/proveedor/domain/documentosProveedor";

const h = vi.hoisted(() => ({
  useProveedorDocumentos: vi.fn(),
  eliminarMutate: vi.fn(),
}));
vi.mock("@/features/proveedor/hooks/useProveedorDocumentos", () => ({
  useProveedorDocumentos: h.useProveedorDocumentos,
  useEliminarDocumentoProveedor: () => ({ mutateAsync: h.eliminarMutate, isPending: false }),
  useSubirDocumentoProveedor: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { ProveedorDocumentosTab } from "@/features/proveedor/components/ProveedorDocumentosTab";

const doc: DocumentoProveedor = {
  id: "d1",
  proveedor_id: "p1",
  tipo: "Constancia de situación fiscal",
  nombre: "csf.pdf",
  archivo: "proveedores/p1/csf.pdf",
  mime_type: "application/pdf",
  tamano_bytes: 2048,
  fecha_documento: "2026-01-10",
  fecha_vencimiento: null,
  notas: null,
  created_at: "2026-01-10T10:00:00Z",
};

function renderTab() {
  return render(
    <ProveedorDocumentosTab
      proveedorId="p1"
      organizationId="o1"
      esNacional
      canEdit
    />,
  );
}

beforeEach(() => {
  h.useProveedorDocumentos.mockReset();
});

describe("ProveedorDocumentosTab", () => {
  it("muestra el documento cargado", () => {
    h.useProveedorDocumentos.mockReturnValue({
      data: [doc],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });
    renderTab();
    expect(screen.getByText("csf.pdf")).toBeInTheDocument();
  });

  it("un error de carga NO se muestra como expediente vacío", () => {
    const refetch = vi.fn();
    h.useProveedorDocumentos.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("permiso denegado"),
      refetch,
      isFetching: false,
    });
    renderTab();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/permiso denegado/)).toBeInTheDocument();
    expect(screen.queryByText(/Sin documentos/i)).not.toBeInTheDocument();
  });
});
