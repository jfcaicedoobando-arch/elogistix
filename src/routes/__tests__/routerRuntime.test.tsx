/**
 * Contratos de navegación con el React Router instalado (modo declarativo).
 *
 * Verifican comportamiento en runtime (no sólo estructura del árbol de rutas):
 *  - `Routes`/`Route`/`Navigate` siguen resolviendo rutas anidadas y profundas.
 *  - `RedirectPreserveSearch` preserva querystring y hash en los redirects legacy.
 *  - Los enlaces relativos y el trailing slash conservan la semántica de v6.
 *  - El adaptador `nuqs/adapters/react-router/v8` sincroniza filtros con la URL.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import {
  BrowserRouter,
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { useQueryState } from "nuqs";
import { RedirectPreserveSearch } from "../RedirectPreserveSearch";

function UrlProbe() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="url">{`${pathname}${search}${hash}`}</div>;
}

function ParamProbe() {
  const params = useParams();
  return <div data-testid="params">{JSON.stringify(params)}</div>;
}

function LayoutShell() {
  return (
    <div>
      <span>layout</span>
      <Outlet />
    </div>
  );
}

describe("React Router — rutas declarativas", () => {
  it("resuelve rutas profundas anidadas con parámetros", () => {
    render(
      <MemoryRouter initialEntries={["/crm/clientes/abc-123/contactos"]}>
        <Routes>
          <Route path="/crm" element={<LayoutShell />}>
            <Route path="clientes/:clienteId/contactos" element={<ParamProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("layout")).toBeInTheDocument();
    expect(screen.getByTestId("params").textContent).toContain('"clienteId":"abc-123"');

  });

  it("aplica Navigate en redirecciones sin acceso", () => {
    render(
      <MemoryRouter initialEntries={["/embarques"]}>
        <Routes>
          <Route path="/embarques" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<UrlProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("url").textContent).toBe("/login");
  });

  it("preserva querystring y hash en redirects legacy", () => {
    render(
      <MemoryRouter initialEntries={["/cxp/por-capturar?estado=pendiente&page=2#tabla"]}>
        <Routes>
          <Route
            path="/cxp/por-capturar"
            element={<RedirectPreserveSearch to="/compras/por-capturar" />}
          />
          <Route path="/compras/por-capturar" element={<UrlProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("url").textContent).toBe(
      "/compras/por-capturar?estado=pendiente&page=2#tabla",
    );
  });

  it("trata el trailing slash como la misma ruta", () => {
    render(
      <MemoryRouter initialEntries={["/cotizaciones/"]}>
        <Routes>
          <Route path="/cotizaciones" element={<UrlProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("url").textContent).toBe("/cotizaciones/");
  });

  it("resuelve enlaces relativos dentro de una ruta anidada", () => {
    render(
      <MemoryRouter initialEntries={["/portal/embarques"]}>
        <Routes>
          <Route path="/portal" element={<LayoutShell />}>
            <Route path="embarques" element={<Link to="detalle/9">ver</Link>} />
            <Route path="embarques/detalle/:id" element={<ParamProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("ver"));
    expect(screen.getByTestId("params").textContent).toContain('"id":"9"');
  });

  it("mantiene navegación atrás/adelante en rutas profundas", () => {
    // `MemoryRouter` tiene su propio historial: `window.history.back()` no lo
    // mueve. Se navega con `useNavigate(-1)` contra las entradas iniciales.
    function Atras() {
      const navigate = useNavigate();
      return (
        <>
          <UrlProbe />
          <button onClick={() => navigate(-1)}>atras</button>
          <button onClick={() => navigate(1)}>adelante</button>
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={["/agente", "/agente/tarifas"]} initialIndex={1}>
        <Routes>
          <Route path="/agente" element={<Atras />} />
          <Route path="/agente/tarifas" element={<Atras />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("url").textContent).toBe("/agente/tarifas");
    fireEvent.click(screen.getByText("atras"));
    expect(screen.getByTestId("url").textContent).toBe("/agente");
    fireEvent.click(screen.getByText("adelante"));
    expect(screen.getByTestId("url").textContent).toBe("/agente/tarifas");
  });
});

describe("NuqsAdapter v8 — filtros en query string", () => {
  // nuqs agenda la hidratación y la escritura del query param en temporizadores
  // internos. Con temporizadores falsos se drenan dentro de `act`, de modo que
  // React no reporta actualizaciones fuera de act.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    cleanup();
    // Restaurar el historial después de desmontar evita notificar a los
    // suscriptores del caso anterior. nuqs sólo soporta BrowserRouter.
    await act(async () => {
      window.history.replaceState(null, "", "/");
    });
  });

  /** Drena los temporizadores pendientes de nuqs dentro de `act`. */
  async function drenarNuqs() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
  }

  function Filtros() {
    const [estado, setEstado] = useQueryState("estado");
    return (
      <div>
        <div data-testid="estado">{estado ?? "sin-filtro"}</div>
        <button onClick={() => void setEstado("en_transito")}>filtrar</button>
      </div>
    );
  }

  it("lee el valor inicial desde la URL", async () => {
    window.history.replaceState(null, "", "/embarques?estado=en_puerto");
    // El montaje del adaptador de nuqs programa una hidratación asíncrona del
    // estado desde la URL: se envuelve el render en act para capturarla.
    await act(async () => {
      render(
        <BrowserRouter>
          <NuqsAdapter>
            <Routes>
              <Route path="/embarques" element={<Filtros />} />
            </Routes>
          </NuqsAdapter>
        </BrowserRouter>,
      );
    });
    // nuqs programa la hidratación inicial en un timer interno: se drena dentro
    // de act antes de afirmar.
    await drenarNuqs();
    expect(screen.getByTestId("estado").textContent).toBe("en_puerto");
  });

  it("escribe el filtro en la URL sin perder la ruta", async () => {
    window.history.replaceState(null, "", "/embarques");
    await act(async () => {
      render(
        <BrowserRouter>
          <NuqsAdapter>
            <Routes>
              <Route
                path="/embarques"
                element={
                  <>
                    <Filtros />
                    <UrlProbe />
                  </>
                }
              />
            </Routes>
          </NuqsAdapter>
        </BrowserRouter>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText("filtrar"));
    });
    // La escritura del query param es asíncrona (scheduler interno de nuqs):
    // se drena dentro de act antes de afirmar estado y URL.
    await drenarNuqs();
    expect(screen.getByTestId("estado").textContent).toBe("en_transito");
    // El adaptador actualiza la URL real vía History API (shallow).
    expect(window.location.search).toContain("estado=en_transito");
    // La ruta del router no se pierde con la escritura del filtro.
    expect(screen.getByTestId("url").textContent).toContain("/embarques");
  });
});
