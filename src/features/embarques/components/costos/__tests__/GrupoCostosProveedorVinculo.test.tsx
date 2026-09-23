/**
 * P1-2 — Costos con proveedor en texto libre (sin UUID de catálogo) deben
 * distinguirse del proveedor enlazado y ofrecer la acción para vincularlos.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GrupoCostosProveedor } from "../GrupoCostosProveedor";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";

vi.mock("@/hooks/shared/usePermissions", () => ({
  usePermissions: () => ({ canViewFinancials: true, canViewCosts: true }),
}));

const fila: FilaReconciliacion = {
  concepto_costo_id: "cc-1",
  concepto: "Flete Marítimo",
  proveedor_nombre: "Cosco Shipping Lines",
  moneda: "USD",
  cotizado: 1000,
  real_facturado: 0,
  diferencia: -1000,
  desviacion_pct: -100,
  estado_liquidacion: "Pendiente",
  estatus_renglon: "sin_match",
  facturas: [],
};

function renderGrupo(vinculado: boolean, onVincular?: () => void) {
  return render(
    <MemoryRouter>
      <GrupoCostosProveedor
        proveedorNombre="Cosco Shipping Lines"
        filas={[fila]}
        vinculadoACatalogo={vinculado}
        onVincularProveedor={onVincular}
      />
    </MemoryRouter>,
  );
}

describe("GrupoCostosProveedor · vínculo con el catálogo", () => {
  it("avisa cuando el proveedor es sólo un nombre libre", () => {
    renderGrupo(false);
    expect(screen.getByTestId("costos-proveedor-sin-vinculo")).toBeInTheDocument();
    expect(screen.getByText(/Nombre sin vincular al catálogo/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Dar de alta en Compras/i }),
    ).toHaveAttribute("href", "/compras/proveedores");
  });

  it("no avisa nada cuando el costo ya está vinculado al catálogo", () => {
    renderGrupo(true);
    expect(screen.queryByTestId("costos-proveedor-sin-vinculo")).toBeNull();
  });

  it("ofrece la acción existente para vincular el proveedor", () => {
    const onVincular = vi.fn();
    renderGrupo(false, onVincular);
    fireEvent.click(screen.getByRole("button", { name: /Vincular proveedor/i }));
    expect(onVincular).toHaveBeenCalledTimes(1);
  });
});
