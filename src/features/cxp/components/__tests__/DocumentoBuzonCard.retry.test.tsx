/**
 * La tarjeta del documento del buzón ofrece "Reintentar lectura" cuando la
 * autocarga falló, y no la ofrece en éxito.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentoBuzonCard } from "@/features/cxp/components/DocumentoBuzonCard";

const ENTRANTE = {
  id: "doc-1", archivoPath: "org1/doc.xml", nombreArchivo: "doc.xml",
  xmlPath: "org1/doc.xml", xmlNombre: "doc.xml", expediente: "ELIMP00302",
} as never;

describe("DocumentoBuzonCard", () => {
  it("muestra el botón de reintento en error", async () => {
    const onReintentar = vi.fn();
    render(
      <DocumentoBuzonCard
        entrante={ENTRANTE} estado="error" mensaje="Falló la lectura"
        onVerArchivo={vi.fn()} onReintentar={onReintentar}
      />,
    );
    const btn = screen.getByRole("button", { name: /reintentar lectura/i });
    btn.click();
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it("no muestra reintento cuando la lectura fue exitosa", () => {
    render(
      <DocumentoBuzonCard
        entrante={ENTRANTE} estado="listo" mensaje={null}
        onVerArchivo={vi.fn()} onReintentar={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /reintentar lectura/i })).toBeNull();
  });
});
