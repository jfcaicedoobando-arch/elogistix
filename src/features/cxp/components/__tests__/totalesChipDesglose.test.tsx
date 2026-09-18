import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalesChipDesglose } from "../TotalesChipDesglose";

/**
 * El capturista concilia costos contra el subtotal (sin impuestos): la cifra
 * grande del chip debe ser ésa, y el total con IVA queda como referencia.
 */
describe("TotalesChipDesglose", () => {
  it("encabeza con el subtotal y deja el total del documento como secundario", () => {
    render(
      <TotalesChipDesglose
        subtotal={295} iva={47.2} ieps={0} retenciones={0}
        total={342.2} moneda="USD"
      />,
    );

    const chip = screen.getByRole("button");
    expect(chip.textContent).toContain("Subtotal USD");
    expect(chip.textContent).toContain("295");
    expect(chip.textContent).toContain("Total del documento");
    expect(chip.textContent).not.toContain("Total con IVA");
    expect(chip.textContent).toContain("342.20");
    // La etiqueta grande ya no dice sólo "Total USD".
    expect(chip.textContent).not.toContain("Total USD");
  });

  it("con IEPS y retenciones sigue llamándolo total del documento, no 'con IVA'", () => {
    render(
      <TotalesChipDesglose
        subtotal={1000} iva={160} ieps={40} retenciones={100}
        total={1100} moneda="MXN"
      />,
    );
    const chip = screen.getByRole("button");
    expect(chip.textContent).toContain("Total del documento");
    expect(chip.textContent).not.toContain("Total con IVA");
    expect(chip.textContent).toContain("1,100.00");
  });
});
