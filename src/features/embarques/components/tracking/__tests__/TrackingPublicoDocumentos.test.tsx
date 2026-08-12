/**
 * Cobertura de la vista pública de documentos y estatus del embarque.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TrackingPublicoDocumento } from "@/features/embarques/services/tracking";
import { TrackingPublicoDocumentos } from "../TrackingPublicoDocumentos";
import { TrackingPublicoEstatus } from "../TrackingPublicoEstatus";

const docs: TrackingPublicoDocumento[] = [
  { nombre: "Factura Comercial", estado: "Validado", requerido: true, recibido: true },
  { nombre: "Packing List", estado: "Pendiente", requerido: true, recibido: false },
];

describe("TrackingPublicoDocumentos", () => {
  it("separa recibidos y faltantes con el conteo correcto", () => {
    render(<TrackingPublicoDocumentos documentos={docs} />);
    expect(screen.getByText("Recibidos (1)")).toBeInTheDocument();
    expect(screen.getByText("Faltantes (1)")).toBeInTheDocument();
    expect(screen.getByText("Falta")).toBeInTheDocument();
  });

  it("indica qué hacer cuando no hay documentos requeridos", () => {
    render(<TrackingPublicoDocumentos documentos={[]} />);
    expect(screen.getByText("Todavía no se requieren documentos")).toBeInTheDocument();
  });
});

describe("TrackingPublicoEstatus", () => {
  it("muestra ETD/ETA y el avance documental", () => {
    render(
      <TrackingPublicoEstatus
        estado="En Tránsito"
        etd="2026-08-01"
        eta={null}
        documentosRecibidos={1}
        documentosTotales={2}
      />,
    );
    expect(screen.getByText("01/08/2026")).toBeInTheDocument();
    expect(screen.getByText("Por confirmar")).toBeInTheDocument();
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
  });
});
