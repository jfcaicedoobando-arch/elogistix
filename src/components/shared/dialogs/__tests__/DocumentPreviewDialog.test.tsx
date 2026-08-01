import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentPreviewDialog } from "@/components/shared/dialogs/DocumentPreviewDialog";

describe("<DocumentPreviewDialog />", () => {
  it("renderiza <object> application/pdf para PDFs", () => {
    render(
      <DocumentPreviewDialog
        open
        onOpenChange={() => {}}
        title="Proforma.pdf"
        url="https://example.com/file.pdf"
      />,
    );
    const visor = screen.getByTitle("Proforma.pdf") as HTMLObjectElement;
    expect(visor.tagName).toBe("OBJECT");
    expect(visor.type).toBe("application/pdf");
    expect(visor.data).toContain("file.pdf");
  });

  it("renderiza <img> para imágenes", () => {
    render(
      <DocumentPreviewDialog
        open
        onOpenChange={() => {}}
        title="Logo"
        url="https://example.com/logo.png"
      />,
    );
    const img = screen.getByAltText("Logo") as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
  });

  it("muestra placeholder cuando url=null", () => {
    render(
      <DocumentPreviewDialog
        open
        onOpenChange={() => {}}
        title="X"
        url={null}
      />,
    );
    expect(screen.getByText(/no hay documento/i)).toBeInTheDocument();
  });

  it("invoca onDownload al hacer click en Descargar", () => {
    const onDownload = vi.fn();
    render(
      <DocumentPreviewDialog
        open
        onOpenChange={() => {}}
        title="X"
        url="https://example.com/f.pdf"
        onDownload={onDownload}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /descargar/i }));
    expect(onDownload).toHaveBeenCalled();
  });

  it("omite Descargar cuando no hay onDownload", () => {
    render(
      <DocumentPreviewDialog
        open
        onOpenChange={() => {}}
        title="X"
        url="https://example.com/f.pdf"
      />,
    );
    expect(screen.queryByRole("button", { name: /descargar/i })).toBeNull();
  });
});
