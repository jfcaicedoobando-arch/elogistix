/**
 * Plan B (audit Sentry): cubre que el `ErrorBoundary`:
 *  1) Renderiza el fallback con el mensaje del error y un botón "Reintentar".
 *  2) Invoca `Sentry.captureException` dentro de `withScope` con tag
 *     `crashed_route` = `window.location.pathname`.
 *  3) Reporta también a `logClientError` (persistencia paralela).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => {
  const setTag = vi.fn();
  const setContext = vi.fn();
  const withScope = vi.fn((cb: (s: { setTag: typeof setTag; setContext: typeof setContext }) => void) => {
    cb({ setTag, setContext });
  });
  return {
    setTag,
    setContext,
    withScope,
    captureException: vi.fn(() => "evt-123"),
    getFeedback: vi.fn(() => null),
    getCurrentScope: vi.fn(() => ({ setTag })),
    logClientError: vi.fn(),
  };
});

vi.mock("@sentry/react", () => ({
  withScope: mocks.withScope,
  captureException: mocks.captureException,
  getFeedback: mocks.getFeedback,
  getCurrentScope: mocks.getCurrentScope,
}));

vi.mock("@/services/observability", () => ({ logClientError: mocks.logClientError }));

import { ErrorBoundary } from "../ErrorBoundary";

function Boom(): React.JSX.Element {
  throw new Error("ui-explota");
}

let errSpy: ReturnType<typeof vi.spyOn>;
// Auditoría 13.137.32: capturamos location dentro de beforeEach para evitar
// snapshot contaminado si otro archivo del shard mutó window.location antes.
let originalLocation: Location;

beforeEach(() => {
  originalLocation = window.location;
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.withScope.mockClear();
  mocks.setTag.mockClear();
  mocks.captureException.mockClear();
  mocks.logClientError.mockClear();
});

afterEach(() => {
  errSpy.mockRestore();
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  cleanup();
});

describe("ErrorBoundary", () => {
  it("muestra fallback con mensaje del error y botón Reintentar", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/algo salió mal/i)).toBeInTheDocument();
    // El stack también contiene "ui-explota"; seleccionamos el <span> del campo Mensaje.
    expect(screen.getByText("ui-explota", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("captura en Sentry con tag crashed_route = pathname actual", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, pathname: "/embarques/123" },
    });

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    await waitFor(() => expect(mocks.withScope).toHaveBeenCalled());
    expect(mocks.setTag).toHaveBeenCalledWith("crashed_route", "/embarques/123");
    expect(mocks.setTag).toHaveBeenCalledWith("source", "react-error-boundary");
    expect(mocks.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: "ui-explota" }));
  });

  it("también persiste el error vía logClientError (doble reporte)", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(mocks.logClientError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "ui-explota" }),
    );
  });
});
