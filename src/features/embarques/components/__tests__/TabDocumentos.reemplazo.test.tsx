import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { DocumentoEmbarqueRow } from "@/features/embarques/types/embarque";
import { TabDocumentos } from "../TabDocumentos";

vi.mock("../tabDocumentos/AgregarDocumentoDialog", () => ({ AgregarDocumentoDialog: () => null }));
vi.mock("../tabDocumentos/RechazarDocumentoDialog", () => ({ RechazarDocumentoDialog: () => null }));

const documento = (archivo: string | null): DocumentoEmbarqueRow => ({
  id: "documento-fixture", embarque_id: "embarque-fixture", organization_id: "org-fixture",
  nombre: "BL Master", archivo, estado: archivo ? "Recibido" : "Pendiente", notas: null,
  created_at: "2026-11-02T12:00:00Z", updated_at: null, deleted_at: null, deleted_by: null,
});

let picker: HTMLInputElement | undefined;
beforeEach(() => {
  picker = undefined;
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag, options) => {
    const element = createElement(tag, options);
    if (tag === "input") picker = element as HTMLInputElement;
    return element;
  });
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function setup(archivo: string | null, canEdit = true) {
  const onUpload = vi.fn();
  const onDownload = vi.fn();
  const props = {
    embarqueId: "embarque-fixture", documentos: [documento(archivo)], canEdit,
    uploadingDocId: null, downloadingDocId: null, onUpload, onDownload,
  };
  const view = render(<MemoryRouter><TabDocumentos {...props} /></MemoryRouter>);
  return { ...view, onUpload, onDownload, props };
}

function chooseFile(action: string, files: File[]) {
  fireEvent.click(screen.getByRole("button", { name: action }));
  expect(picker).toBeDefined();
  fireEvent.change(picker!, { target: { files } });
}

describe("documentos: primera carga y reemplazo confirmado", () => {
  it("sube el primer archivo directamente, sin una confirmación de reemplazo", () => {
    const { onUpload } = setup(null);
    const file = new File(["contenido-ficticio"], "primer-bl.pdf");
    chooseFile("Subir archivo", [file]);
    expect(onUpload).toHaveBeenCalledExactlyOnceWith("documento-fixture", file);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("cancelar conserva el adjunto; sólo confirmar una selección posterior inicia la carga", () => {
    const { onUpload, onDownload } = setup("embarques/fixture/bl-anterior.pdf");
    const descartado = new File(["descartado"], "bl-descartado.pdf");
    chooseFile("Reemplazar archivo", [descartado]);
    const dialog = screen.getByRole("alertdialog", { name: "¿Reemplazar archivo?" });
    expect(dialog).toHaveTextContent("BL Master");
    expect(dialog).toHaveTextContent(descartado.name);
    expect(dialog).toHaveTextContent("El archivo anterior dejará de estar disponible");
    expect(onUpload).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descargar" }));
    expect(onDownload).toHaveBeenCalledExactlyOnceWith("embarques/fixture/bl-anterior.pdf", "documento-fixture");

    const confirmado = new File(["confirmado"], "bl-confirmado.pdf");
    chooseFile("Reemplazar archivo", [confirmado]);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Reemplazar archivo" }));
    expect(onUpload).toHaveBeenCalledExactlyOnceWith("documento-fixture", confirmado);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("salir del selector sin archivo no solicita confirmación ni inicia la carga", () => {
    const { onUpload } = setup("embarques/fixture/bl-anterior.pdf");
    chooseFile("Reemplazar archivo", []);
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("no confirma un reemplazo si deja de estar habilitada la edición", () => {
    const { onUpload, props, rerender } = setup("embarques/fixture/bl-anterior.pdf");
    chooseFile("Reemplazar archivo", [new File(["fixture"], "bl-nuevo.pdf")]);
    rerender(<MemoryRouter><TabDocumentos {...props} canEdit={false} /></MemoryRouter>);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Reemplazar archivo" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Reemplazar archivo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar" })).toBeEnabled();
  });
});
