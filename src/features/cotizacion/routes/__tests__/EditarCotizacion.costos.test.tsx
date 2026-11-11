import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";

const fetchCostos = vi.hoisted(() => vi.fn());
vi.mock("@/features/cotizacion/services", () => ({ fetchCotizacionCostos: fetchCostos }));
vi.mock("@/features/cotizacion/hooks", async () => {
  const { useCotizacionCostos } = await import("../../hooks/useCotizacionCostos");
  return {
    useCotizacionCostos,
    useCotizacion: () => ({ data: { id: "cot-1", folio: "COT-1", estado: "Borrador", embarque_id: null }, isLoading: false, isError: false }),
    useCreateCotizacion: () => ({}), useUpdateCotizacion: () => ({}), useUpsertCotizacionCostos: () => ({}),
    useCotizacionWizardForm: (args: { initialCostos: { concepto: string }[] }) => useWizardPrueba(args),
  };
});
function useWizardPrueba({ initialCostos }: { initialCostos: { concepto: string }[] }) {
  const [captura, setCaptura] = useState(initialCostos.map(c => c.concepto).join(", "));
  return { captura, setCaptura };
}
vi.mock("@/features/cotizacion/components/CotizacionWizardLayout", () => ({
  default: ({ w }: { w: ReturnType<typeof useWizardPrueba> }) => <input aria-label="Costos capturados" value={w.captura} onChange={e => w.setCaptura(e.target.value)} />,
}));
vi.mock("@/features/cliente/hooks", () => ({ useClientesForSelect: () => ({ data: [] }) }));
vi.mock("@/hooks/shared", () => ({ useToast: () => ({ toast: vi.fn() }), usePermissions: () => ({ canWriteCotizaciones: true }), useRegistrarActividad: () => ({}) }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "usuario@ejemplo.test" } }) }));
vi.mock("@/lib/contexts/BreadcrumbContext", () => ({ useRegisterBreadcrumbLabel: () => undefined }));

import EditarCotizacion from "../EditarCotizacion";
let client: QueryClient;
beforeEach(() => { fetchCostos.mockReset(); client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); });
afterEach(async () => { cleanup(); await client.cancelQueries(); client.clear(); });
function mount() {
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/cotizaciones/cot-1/editar"]}><Routes>
    <Route path="/cotizaciones/:id/editar" element={<EditarCotizacion />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}

it("fallo inicial bloquea el wizard y reintentar lo abre con todos los costos", async () => {
  fetchCostos.mockRejectedValueOnce(new Error("lectura fallida"));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los costos");
  expect(screen.queryByLabelText("Costos capturados")).not.toBeInTheDocument();
  fetchCostos.mockResolvedValueOnce([{ concepto: "Flete" }, { concepto: "Maniobras" }]);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByLabelText("Costos capturados")).toHaveValue("Flete, Maniobras");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("un vacío confirmado sí permite abrir la captura", async () => {
  fetchCostos.mockResolvedValueOnce([]);
  mount();
  expect(await screen.findByLabelText("Costos capturados")).toHaveValue("");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("un error de actualización posterior conserva la captura local al reintentar", async () => {
  fetchCostos.mockResolvedValueOnce([{ concepto: "Flete" }]);
  mount();
  fireEvent.change(await screen.findByLabelText("Costos capturados"), { target: { value: "Captura sin guardar" } });
  fetchCostos.mockRejectedValueOnce(new Error("sin conexión"));
  await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.cotizaciones.costos("cot-1") }); });
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron actualizar los costos");
  expect(screen.getByLabelText("Costos capturados")).toHaveValue("Captura sin guardar");
  fetchCostos.mockResolvedValueOnce([{ concepto: "Flete actualizado" }]);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(screen.getByLabelText("Costos capturados")).toHaveValue("Captura sin guardar");
});
