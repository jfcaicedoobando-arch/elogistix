/**
 * v13.819.2 — El CTA "Ver embarque" sólo aparece cuando el rol tiene acceso a
 * la ruta de embarques y el destino es otro embarque (no el actual).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AppRole } from "@/types/appRole";
import type { UbicacionDuplicadoBuzon } from "@/features/cxp/services/buzonDuplicado";

const rol = vi.hoisted(() => ({ actual: "coordinador_logistico" as AppRole }));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ effectiveRole: rol.actual }),
}));

const { AvisoDuplicadoBuzon } = await import(
  "@/features/embarques/components/entrantes/AvisoDuplicadoBuzon"
);

const OTRO: UbicacionDuplicadoBuzon = {
  caso: "otro_embarque",
  facturaId: "fac-1",
  embarqueId: "emb-2",
  embarqueExpediente: "EXP-0099",
};

function montar(ubicacion: UbicacionDuplicadoBuzon, mensaje: string) {
  return render(
    <MemoryRouter>
      <AvisoDuplicadoBuzon mensaje={mensaje} ubicacion={ubicacion} embarqueActualId="emb-1" />
    </MemoryRouter>,
  );
}

describe("AvisoDuplicadoBuzon", () => {
  it("muestra el CTA al embarque destino cuando el rol tiene acceso", () => {
    rol.actual = "coordinador_logistico";
    montar(OTRO, "Esta factura ya está registrada en el embarque EXP-0099.");
    const cta = screen.getByRole("link", { name: /Ver embarque/i });
    expect(cta).toHaveAttribute("href", "/embarques/emb-2");
    expect(screen.getByText(/embarque EXP-0099/)).toBeInTheDocument();
  });

  it("sin permiso a /embarques no enlaza: sólo folio y orientación", () => {
    rol.actual = "ejecutivo_cobranza";
    montar(OTRO, "Esta factura ya está registrada en el embarque EXP-0099.");
    expect(screen.queryByRole("link", { name: /Ver embarque/i })).toBeNull();
    expect(screen.getByText(/Pide a Operaciones que revise el embarque EXP-0099/)).toBeInTheDocument();
  });

  it("mismo embarque: mensaje sin CTA (ya está aquí)", () => {
    rol.actual = "coordinador_logistico";
    montar(
      { caso: "mismo_embarque", facturaId: "fac-1", embarqueId: "emb-1", embarqueExpediente: "EXP-1" },
      "Esta factura ya está registrada en este embarque.",
    );
    expect(screen.queryByRole("link", { name: /Ver embarque/i })).toBeNull();
    expect(screen.getByText("Esta factura ya está registrada en este embarque.")).toBeInTheDocument();
  });

  it("duplicado ajeno: mensaje genérico y sin datos de otra organización", () => {
    rol.actual = "coordinador_logistico";
    montar(
      { caso: "ajeno", facturaId: null, embarqueId: null, embarqueExpediente: null },
      "Esta factura ya está registrada. Solicita a Operaciones que revise el documento.",
    );
    expect(screen.queryByRole("link", { name: /Ver embarque/i })).toBeNull();
    expect(screen.getByText(/Solicita a Operaciones/)).toBeInTheDocument();
  });
});
