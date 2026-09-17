/**
 * EMB-NEW-06 — el detalle de cada paso no se recorta: "6 generadas · 2 sin
 * emitir" debe verse completo (envuelve en dos líneas, sin `truncate`).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlujoFacturacionStepper } from "../facturacion/FlujoFacturacionStepper";

describe("FlujoFacturacionStepper · detalle completo", () => {
  it("muestra el texto íntegro, sin truncate y sin atributo title nativo", () => {
    render(
      <FlujoFacturacionStepper
        conceptosCount={10}
        facturadosCount={4}
        proformasCount={6}
        proformasConvertidasCount={2}
        proformasEmitidasCount={0}
        facturasCount={2}
        facturasEmitidasCount={0}
      />,
    );
    const detalle = screen.getByText("6 generadas · 2 sin emitir");
    expect(detalle).toBeInTheDocument();
    expect(detalle.className).not.toContain("truncate");
    expect(detalle).not.toHaveAttribute("title");
  });
});
