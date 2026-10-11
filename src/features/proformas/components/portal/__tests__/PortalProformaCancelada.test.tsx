import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PortalProforma from "../../../routes/PortalProforma";

vi.mock("react-router", () => ({ useParams: () => ({ token: "synthetic" }) }));
vi.mock("@/components/shared/Seo", () => ({ Seo: () => null }));
vi.mock("@/components/shared/DetailHeader", () => ({ DetailHeader: () => null }));
vi.mock("@/features/proformas/hooks/usePortalProforma", () => ({ usePortalProforma: () => ({
  loading: false, error: null, data: { estado_link: "cancelada", proforma: { id: "history", numero: "SYNTH" }, conceptos: [] },
}) }));
vi.mock("@/features/proformas/components/portal/PortalProformaResumen", () => ({ PortalProformaResumen: () => <span>Detalle de importes</span> }));
vi.mock("@/features/proformas/components/portal/PortalProformaAcciones", () => ({ PortalProformaAcciones: () => <button>Aceptar proforma</button> }));

describe("portal de proforma cancelada", () => {
  it("explica la cancelación y pide una nueva proforma sin acciones ni importes", () => {
    render(<PortalProforma />);
    expect(screen.getByText("Esta proforma fue cancelada")).toBeInTheDocument();
    expect(screen.getByText(/Solicita a tu ejecutivo una nueva proforma/)).toBeInTheDocument();
    expect(screen.queryByText("Detalle de importes")).toBeNull();
    expect(screen.queryByRole("button", { name: "Aceptar proforma" })).toBeNull();
  });
});
