import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FacturaFormValues } from "../../types";
import { ResumenCapturaFactura } from "../ResumenCapturaFactura";

const values: FacturaFormValues = {
  provId: "proveedor-fixture", provNombre: "Proveedor fixture", folio: "F-1",
  emision: "2026-10-07", vencimiento: "2026-10-07", diasCredito: 0,
  moneda: "MXN", tc: "1", subtotal: "0", iva: "0", ieps: "0", retenciones: "0",
  categoriaId: "categoria-fixture", notas: "",
};

describe("ResumenCapturaFactura · moneda del total", () => {
  it.each(["MXN", "USD"] as const)("identifica cero y decimales en %s una sola vez", (moneda) => {
    const onEditarDatos = vi.fn();
    const props = { values: { ...values, moneda }, total: 0, vinculos: 0, onEditarDatos };
    const { rerender } = render(<ResumenCapturaFactura {...props} />);
    const comprobarTotal = (importe: string) => {
      const fila = screen.getByText("Total", { exact: true }).parentElement!;
      expect(within(fila).getByText(importe, { exact: true })).toBeInTheDocument();
      expect(fila.textContent?.match(new RegExp(moneda, "g"))).toHaveLength(1);
      expect(screen.queryByText(`Total ${moneda}`, { exact: true })).not.toBeInTheDocument();
    };

    comprobarTotal(`${moneda} 0.00`);
    fireEvent.click(screen.getByRole("button", { name: "Corregir datos de la factura" }));
    expect(onEditarDatos).toHaveBeenCalledTimes(1);
    rerender(<ResumenCapturaFactura {...props} total={1234.56} vinculos={2} />);
    comprobarTotal(`${moneda} 1,234.56`);
    expect(screen.getByText("2 costos vinculados.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Corregir datos de la factura" }));
    expect(onEditarDatos).toHaveBeenCalledTimes(2);
    rerender(<ResumenCapturaFactura {...props} />);
    comprobarTotal(`${moneda} 0.00`);
  });
});
