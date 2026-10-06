import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ProveedorBrechaCard } from "../ProveedorBrechaCard";
import type { BrechaFacturacion, FacturaHuerfana } from "../../domain/estadoCuentaProveedor";

const brecha: BrechaFacturacion = {
  totalPartidas: 1,
  partidasPendientes: 0,
  partidasSobrefacturadas: 0,
  porFacturarPorMoneda: {},
};

describe("ProveedorBrechaCard — auditoría 72", () => {
  it("muestra el neto calculado por el RPC para 3 unidades de MXN1 y cuenta una partida", () => {
    const huerfanas: FacturaHuerfana[] = [{
      factura_id: "fp15", folio_interno: "FP-000015", folio_proveedor: null,
      fecha_emision: "2026-10-04", moneda: "MXN", monto_sin_vincular: 3, partidas: 1,
    }];
    render(
      <MemoryRouter>
        <ProveedorBrechaCard brecha={brecha} huerfanas={huerfanas} proveedorNombre="Maniobras" proveedorId="aud72-proveedor" />
      </MemoryRouter>,
    );

    const partida = screen.getByRole("link", { name: "FP-000015" }).closest("li");
    expect(partida).toHaveTextContent("1 partida(s)");
    expect(partida).toHaveTextContent("3.00");
    expect(partida).not.toHaveTextContent("1.00");
    expect(screen.getByText("1 factura(s) con partidas sin vincular a un costo")).toBeInTheDocument();
  });
});
