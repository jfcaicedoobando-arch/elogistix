import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import * as Sentry from "@sentry/react";
import type { Envelope } from "@sentry/core";
import { reactRouterBrowserTracingIntegration } from "@sentry/react/react-router";
import { scrubSpanPii } from "../spanPrivacy";
import { markSentryReady } from "../runtimeState";
import { AppRoutes } from "@/routes";

vi.mock("@/routes/publicRoutes", () => ({ publicRoutes: null }));
vi.mock("@/routes/portalRoutes", () => ({ portalRoutes: null }));
vi.mock("@/routes/adminRoutes", () => ({ adminRoutes: null }));
vi.mock("@/routes/agenteRoutes", () => ({ agenteRoutes: null }));
vi.mock("@/routes/appRoutes", async () => {
  const { Route } = await import("react-router");
  const { useState } = await import("react");
  function Form() {
    const [value, setValue] = useState("");
    return <input aria-label="mock draft" value={value} onChange={(e) => setValue(e.target.value)} />;
  }
  return { appRoutes: <Route path="/facturacion/:id" element={<Form />} /> };
});

afterEach(async () => { cleanup(); await Sentry.close(2000); });

it("SDK 11 instruments actual AppRoutes after async init without losing an in-progress form", async () => {
  const envelopes: Envelope[] = [];
  const callback = vi.fn(scrubSpanPii);
  render(<MemoryRouter initialEntries={["/facturacion/00000000-0000-0000-0000-000000000001"]}>
    <AppRoutes />
  </MemoryRouter>);
  fireEvent.change(screen.getByLabelText("mock draft"), { target: { value: "Monterrey importación" } });
  Sentry.init({
    dsn: "https://mock@mock.invalid/1", defaultIntegrations: false,
    integrations: [reactRouterBrowserTracingIntegration()],
    tracesSampleRate: 1, beforeSendSpan: callback,
    transport: () => ({
      send: (envelope) => { envelopes.push(envelope); return Promise.resolve({ statusCode: 200 }); },
      flush: () => Promise.resolve(true),
    }),
  });
  await act(async () => markSentryReady());
  expect(screen.getByLabelText("mock draft")).toHaveValue("Monterrey importación");
  Sentry.getActiveSpan()?.end();
  Sentry.startSpan({ name: "mock contract", op: "test",
    attributes: { accessToken: "MOCK_TOKEN", description: "mock@example.invalid" } }, () => undefined);
  await Sentry.flush(2000);
  expect(callback).toHaveBeenCalled();
  const json = JSON.stringify(envelopes);
  expect(json).not.toMatch(/MOCK_TOKEN|mock@example.invalid/);
  expect(json).toContain("mock contract");
  // Router reporter updated the active page-load segment from raw UUID to route template.
  const names = callback.mock.calls.map(([span]) => span.name);
  expect(names).toContain("/facturacion/:id");
});
