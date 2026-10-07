import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { scope, fetchPreview } = vi.hoisted(() => ({
  scope: { organizationId: "org-1" as string | null, orgListo: true },
  fetchPreview: vi.fn(),
}));
vi.mock("@/hooks/shared/useOrgFilter", () => ({ useOrgFilter: () => scope }));
vi.mock("../../services/referenciasEmbarque", () => ({ fetchReferenciasFacturaPreview: fetchPreview }));
import { ReferenciasEmbarquePreview } from "../ReferenciasEmbarquePreview";
import { queryKeys } from "@/lib/query";

const factura = { id: "f1", organization_id: "org-1", embarque_id: "e21", expediente: "HEADER21" };
const fusion = {
  modo: "por_concepto",
  conceptos: [
    { id: "c22", descripcion: "Flete dos pesos", estado: "verificado", referencias: { expediente: "ELNAC22", bl_master: "M22", bl_house: "H22" } },
    { id: "c21", descripcion: "Flete tres pesos", estado: "verificado", referencias: { expediente: "ELNAC21", bl_master: null, bl_house: null } },
    { id: "manual", descripcion: "Servicio manual", estado: "sin_origen", referencias: null },
  ],
};
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...render(<ReferenciasEmbarquePreview factura={factura} />, { wrapper }) };
}

describe("ReferenciasEmbarquePreview", () => {
  beforeEach(() => {
    fetchPreview.mockReset();
    Object.assign(scope, { organizationId: "org-1", orgListo: true });
    fetchPreview.mockResolvedValue(fusion);
  });

  it("asocia dos embarques a sus conceptos y la línea manual no hereda ninguno", async () => {
    setup();
    await screen.findByText("Flete dos pesos");
    const filas = screen.getAllByRole("listitem");
    expect(within(filas[0]).getByText("[Exp. ELNAC22 · BL/M: M22 · BL/H: H22]")).toBeInTheDocument();
    expect(within(filas[1]).getByText("[Exp. ELNAC21]")).toBeInTheDocument();
    expect(filas[2]).toHaveTextContent("no hereda referencias");
    expect(filas[2]).not.toHaveTextContent(/ELNAC|HEADER/);
    expect(screen.queryByText(/Se agregarán como prefijo en cada concepto/)).not.toBeInTheDocument();
    expect(screen.getByText(/Al timbrar se consultan de nuevo/)).toBeInTheDocument();
  });

  it("muestra carga y fallo real, permite reintentar y no lo convierte en ausencia", async () => {
    fetchPreview.mockRejectedValueOnce(new Error("network"));
    setup();
    expect(screen.getByRole("status")).toHaveTextContent("Consultando referencias");
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron verificar");
    expect(screen.queryByText("HEADER21")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar referencias" }));
    await screen.findByText("Flete dos pesos");
    expect(fetchPreview).toHaveBeenCalledTimes(2);
  });

  it("origen ausente se distingue de origen verificado sin referencias", async () => {
    fetchPreview.mockResolvedValue({ modo: "por_concepto", conceptos: [
      { id: "c1", descripcion: "Ausente", estado: "no_disponible", referencias: null },
      { id: "c2", descripcion: "Vacío", estado: "verificado", referencias: { expediente: " ", bl_master: null, bl_house: null } },
    ] });
    setup();
    await screen.findByText("Ausente");
    expect(screen.getByText(/Origen no disponible/)).toBeInTheDocument();
    expect(screen.getByText("Sin referencias de expediente o BL registradas.")).toBeInTheDocument();
  });

  it("manual sin origen explica fallback legado sin inventar referencia", async () => {
    fetchPreview.mockResolvedValue({ modo: "cabecera_legada", conceptos: [
      { id: "manual", descripcion: "Manual", estado: "verificado", referencias: { expediente: null, bl_master: null, bl_house: null } },
    ] });
    setup();
    await screen.findByText("Manual");
    expect(screen.getByText(/Ningún concepto tiene embarque de origen/)).toBeInTheDocument();
    expect(screen.queryByText(/\[Exp\./)).not.toBeInTheDocument();
  });

  it("cambio de organización oculta inmediatamente datos previos y no consulta otro tenant", async () => {
    const { rerender } = setup();
    await screen.findByText("Flete dos pesos");
    scope.organizationId = "org-2";
    rerender(<ReferenciasEmbarquePreview factura={factura} />);
    expect(screen.queryByText("Flete dos pesos")).not.toBeInTheDocument();
    expect(screen.getByText(/No se pudo verificar la organización/)).toBeInTheDocument();
    expect(fetchPreview).toHaveBeenCalledTimes(1);
  });

  it("fallo de una revalidación no deja referencias cacheadas como verificadas", async () => {
    const { client } = setup();
    await screen.findByText("Flete dos pesos");
    fetchPreview.mockRejectedValueOnce(new Error("offline"));
    await client.invalidateQueries({ queryKey: queryKeys.facturacion.referenciasEmbarque("org-1", factura) });
    await screen.findByRole("alert");
    expect(screen.queryByText("Flete dos pesos")).not.toBeInTheDocument();
  });

  it("cambio de factura no muestra referencias del documento anterior durante la carga", async () => {
    const { rerender } = setup();
    await screen.findByText("Flete dos pesos");
    fetchPreview.mockImplementationOnce(() => new Promise(() => {}));
    rerender(<ReferenciasEmbarquePreview factura={{ ...factura, id: "f2" }} />);
    await waitFor(() => expect(fetchPreview).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Flete dos pesos")).not.toBeInTheDocument();
  });
});
