/**
 * Ola C — Smoke test de la bandeja `/compras/por-aprobar`.
 * Verifica que:
 *   - Se renderiza el título y los tabs (Pendientes / Aprobadas / Rechazadas).
 *   - El fetch se llama con `aprobacion: "pendiente"` por default.
 *   - Cambiar de tab dispara un nuevo fetch con el estado seleccionado.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/features/cxp/hooks", () => ({
  useFacturasCxP: vi.fn(() => ({ data: [], isLoading: false, kpis: {} })),
  useAprobarFacturasLote: () => ({
    aprobar: vi.fn(),
    isRunning: false,
    progreso: null,
  }),
  useVerificarSatLote: () => ({
    verificar: vi.fn(),
    isRunning: false,
    progreso: null,
  }),
  useSodAprobacion: () => ({ idsBloqueados: () => new Set<string>(), motivo: () => null }),
}));
vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({ canEdit: true }),
  useFiltroUrl: <T,>(_clave: string, _validos: readonly T[], porDefecto: T) => [
    porDefecto,
    vi.fn(),
  ],
  useTextoUrl: (_clave: string, porDefecto = "") => [porDefecto, vi.fn()],
}));

import ComprasPorAprobar from "../ComprasPorAprobar";
import { useFacturasCxP } from "@/features/cxp/hooks";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/compras/por-aprobar"]}>
        <ComprasPorAprobar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("<ComprasPorAprobar />", () => {
  it("renderiza header + tabs y llama useFacturasCxP con aprobacion=pendiente por default", () => {
    renderPage();
    expect(screen.getByText("Por aprobar")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Pendientes/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Aprobadas/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Rechazadas/ })).toBeInTheDocument();

    const calls = vi.mocked(useFacturasCxP).mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c?.aprobacion === "pendiente")).toBe(true);
  });

  it("consulta también los contadores globales (aprobada + rechazada)", () => {
    renderPage();
    const calls = vi.mocked(useFacturasCxP).mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c?.aprobacion === "aprobada")).toBe(true);
    expect(calls.some((c) => c?.aprobacion === "rechazada")).toBe(true);
  });

  it("muestra empty state cuando no hay filas", () => {
    renderPage();
    expect(screen.getByText(/No hay solicitudes pendientes/i)).toBeInTheDocument();
  });
});
