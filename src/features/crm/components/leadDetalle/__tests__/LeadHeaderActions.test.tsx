/**
 * v13.823.63 — el flujo heredado "Convertir lead" ya no debe existir en la UI.
 * Congela: ningún estado NO convertido ofrece "Convertir", y "Convertido" sólo
 * ofrece "Ver conversión" cuando hay destino (incluso con canEdit=false).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LeadHeaderActions from "../LeadHeaderActions";
import { LEAD_ESTADOS, type CrmLeadEstado } from "@/features/crm/domain/leads/constants";

const noop = () => {};

describe("LeadHeaderActions · retiro de Convertir (v13.823.63)", () => {
  it("no ofrece 'Convertir' en ningún estado, ni con permisos de edición", () => {
    for (const estado of LEAD_ESTADOS) {
      const { unmount } = render(
        <LeadHeaderActions estado={estado} canEdit onEliminar={noop} onVerConversion={noop} />,
      );
      expect(screen.queryByRole("button", { name: /^Convertir$/ })).toBeNull();
      unmount();
    }
  });

  it("no ofrece 'Ver conversión' en estados no convertidos", () => {
    const noConvertidos = LEAD_ESTADOS.filter((e) => e !== "Convertido") as CrmLeadEstado[];
    for (const estado of noConvertidos) {
      const { unmount } = render(
        <LeadHeaderActions estado={estado} canEdit onEliminar={noop} onVerConversion={noop} />,
      );
      expect(screen.queryByRole("button", { name: /Ver conversión/ })).toBeNull();
      unmount();
    }
  });

  it("Convertido con destino ofrece 'Ver conversión' aunque canEdit sea false", () => {
    const onVerConversion = vi.fn();
    render(
      <LeadHeaderActions
        estado="Convertido"
        canEdit={false}
        onEliminar={noop}
        onVerConversion={onVerConversion}
      />,
    );
    const btn = screen.getByRole("button", { name: /Ver conversión/ });
    btn.click();
    expect(onVerConversion).toHaveBeenCalledTimes(1);
    // Sin permisos no debe aparecer la acción destructiva.
    expect(screen.queryByRole("button", { name: /Eliminar/ })).toBeNull();
  });

  it("Convertido sin destino no muestra acción rota", () => {
    render(<LeadHeaderActions estado="Convertido" canEdit onEliminar={noop} />);
    expect(screen.queryByRole("button", { name: /Ver conversión/ })).toBeNull();
    expect(screen.getByText("Convertido")).toBeTruthy();
  });
});
