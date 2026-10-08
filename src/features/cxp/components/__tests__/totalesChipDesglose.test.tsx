import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    expect(chip).toHaveAccessibleName("Subtotal USD 295.00. Total del documento USD 342.20");
    expect(within(chip).getByText("Subtotal", { exact: true })).toBeInTheDocument();
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
    fireEvent.click(chip);
    const desglose = within(screen.getByRole("dialog"));
    for (const [label, importe] of [
      ["Subtotal", "MXN 1,000.00"], ["IVA", "MXN 160.00"], ["IEPS", "MXN 40.00"],
      ["Retenciones", "− MXN 100.00"], ["Total del documento", "MXN 1,100.00"],
    ]) {
      const fila = desglose.getByText(label, { exact: true }).parentElement!;
      expect(fila).toHaveTextContent(`${label}${importe}`);
      expect(fila.textContent?.match(/MXN/g)).toHaveLength(1);
    }
  });

  it.each([
    ["MXN", 0, "MXN 0.00"], ["USD", 0, "USD 0.00"],
    ["MXN", 1234.56, "MXN 1,234.56"], ["USD", 1234.56, "USD 1,234.56"],
  ])("conserva %s %s sin duplicar moneda al abrir, cerrar y reabrir", async (moneda, monto, importe) => {
    render(<TotalesChipDesglose subtotal={monto} iva={0} ieps={0} retenciones={0} total={monto} moneda={moneda} />);
    const chip = screen.getByRole("button", { name: `Subtotal ${importe}. Total del documento ${importe}` });
    expect(chip).toHaveAttribute("type", "button");
    expect(chip).toHaveAttribute("aria-haspopup", "dialog");
    expect(chip).toHaveAttribute("aria-expanded", "false");
    expect(within(chip).getByText("Subtotal", { exact: true })).toBeInTheDocument();
    expect(within(chip).getByText(importe, { exact: true })).toBeInTheDocument();

    chip.focus();
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    const comprobarDesglose = () => {
      const desglose = within(screen.getByRole("dialog"));
      for (const label of ["Subtotal", "Total del documento"]) {
        const fila = desglose.getByText(label, { exact: true }).parentElement!;
        expect(fila).toHaveTextContent(`${label}${importe}`);
        expect(fila.textContent?.match(new RegExp(moneda, "g"))).toHaveLength(1);
      }
      expect(desglose.queryByText("IEPS", { exact: true })).not.toBeInTheDocument();
      expect(desglose.queryByText("Retenciones", { exact: true })).not.toBeInTheDocument();
    };
    comprobarDesglose();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(chip).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(chip).toHaveFocus());
    fireEvent.click(chip);
    comprobarDesglose();
  });
});
