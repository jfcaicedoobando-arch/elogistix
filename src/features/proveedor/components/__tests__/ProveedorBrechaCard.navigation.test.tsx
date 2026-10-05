import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { ProveedorBrechaCard } from "../ProveedorBrechaCard";
import { useCxpPageState } from "@/features/cxp/hooks/useCxpPageState";
import CxpPorCapturar from "@/features/bandejas/routes/CxpPorCapturar";

vi.mock("@/features/bandejas/hooks/useBandejas", () => ({
  useCxpPorCapturar: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/hooks/shared/usePermissions", () => ({
  usePermissions: () => ({ canCapturarFacturaProveedor: false }),
}));
vi.mock("@/features/cxp", () => ({ DialogNuevaFacturaProveedor: () => null }));

const PROVEEDOR_ID = "08664ed8-392d-4421-8e2f-6d0b97cfafc4";
const PROVEEDOR_NOMBRE = "Maniobras y Fletes";

/** Consume el estado real de la bandeja, que prepara sus filtros de servidor. */
function FacturasDestino() {
  const state = useCxpPageState();
  return (
    <>
      <output aria-label="Proveedor seleccionado">{state.proveedorId}</output>
      <output aria-label="Proveedor de la consulta">{state.queryArgs.proveedor_id ?? "todos"}</output>
      <button onClick={() => state.setProveedorId("todos")}>Ver todos los proveedores</button>
    </>
  );
}

function App({ proveedorId = PROVEEDOR_ID }: { proveedorId?: string }) {
  return (
    <BrowserRouter>
      <NuqsAdapter>
        <Routes>
          <Route path="/compras/proveedores/:id" element={
            <ProveedorBrechaCard
              proveedorId={proveedorId}
              proveedorNombre={PROVEEDOR_NOMBRE}
              brecha={{ totalPartidas: 3, partidasPendientes: 3, partidasSobrefacturadas: 0, porFacturarPorMoneda: { MXN: 300 } }}
              huerfanas={[]}
            />
          } />
          <Route path="/compras/facturas" element={<FacturasDestino />} />
          <Route path="/compras/por-capturar" element={<CxpPorCapturar />} />
        </Routes>
      </NuqsAdapter>
    </BrowserRouter>
  );
}

async function montar(url: string, proveedorId = PROVEEDOR_ID) {
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    window.history.replaceState(null, "", url);
    view = render(<App proveedorId={proveedorId} />);
  });
  if (!view) throw new Error("No se montó la navegación del proveedor");
  return view;
}

afterEach(async () => {
  cleanup();
  await act(async () => { window.history.replaceState(null, "", "/"); });
});

describe("AUD73 - alcance de la navegación desde proveedor", () => {
  it("Ver facturas lleva el ID del proveedor a la consulta y lo conserva tras recargar", async () => {
    const view = await montar(`/compras/proveedores/${PROVEEDOR_ID}`);
    expect(screen.getByRole("link", { name: "Ver facturas" })).toHaveAttribute(
      "href", `/compras/facturas?proveedorId=${PROVEEDOR_ID}`,
    );
    fireEvent.click(screen.getByRole("link", { name: "Ver facturas" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Proveedor seleccionado")).toHaveTextContent(PROVEEDOR_ID);
      expect(screen.getByLabelText("Proveedor de la consulta")).toHaveTextContent(PROVEEDOR_ID);
    });
    const url = `${window.location.pathname}${window.location.search}`;
    expect(url).toBe(`/compras/facturas?proveedorId=${PROVEEDOR_ID}`);

    // Una recarga recrea router/hooks desde la URL, sin estado previo en memoria.
    view.unmount();
    await montar(url);
    await waitFor(() => {
      expect(screen.getByLabelText("Proveedor seleccionado")).toHaveTextContent(PROVEEDOR_ID);
      expect(screen.getByLabelText("Proveedor de la consulta")).toHaveTextContent(PROVEEDOR_ID);
    });
  });

  it("usa el ID de cada proveedor y permite ampliar explícitamente el filtro", async () => {
    const otroId = "3faa93f1-8dc7-4c17-9cf2-6da27571905c";
    await montar(`/compras/proveedores/${otroId}`, otroId);
    fireEvent.click(screen.getByRole("link", { name: "Ver facturas" }));
    await waitFor(() => expect(screen.getByLabelText("Proveedor de la consulta")).toHaveTextContent(otroId));
    fireEvent.click(screen.getByRole("button", { name: "Ver todos los proveedores" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Proveedor de la consulta")).toHaveTextContent("todos");
      expect(new URLSearchParams(window.location.search).has("proveedorId")).toBe(false);
    });
  });

  it("Por capturar anuncia el alcance global en origen y destino, también tras recargar", async () => {
    const view = await montar(`/compras/proveedores/${PROVEEDOR_ID}`);
    expect(screen.getByText(/Por capturar muestra embarques de todos los proveedores/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Ir a Por capturar (global)" }));
    await waitFor(() => expect(screen.getByText(/Bandeja de todos los proveedores:/)).toBeInTheDocument());
    expect(window.location.pathname).toBe("/compras/por-capturar");
    expect(window.location.search).toBe("");
    view.unmount();
    await montar("/compras/por-capturar");
    expect(screen.getByText(/Bandeja de todos los proveedores:/)).toBeInTheDocument();
  });
});
