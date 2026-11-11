// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { startServices, scheduleIdle } from "../startServices";

const cliente = {} as QueryClient;

describe("startServices", () => {
  it("difiere la descarga de ambos servicios hasta el idle", async () => {
    const initSentry = vi.fn();
    const bootstrapQueryPersister = vi.fn();
    const pendientes: Array<() => void> = [];

    const loadSentry = vi.fn(async () => ({ initSentry }));
    const loadPersister = vi.fn(async () => ({ bootstrapQueryPersister }));
    const ready = startServices(cliente, {
      loadSentry,
      loadPersister,
      schedule: (cb) => pendientes.push(cb),
    });

    expect(loadSentry).not.toHaveBeenCalled();
    expect(loadPersister).not.toHaveBeenCalled();

    pendientes.forEach((cb) => cb());
    await ready;
    expect(initSentry).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(bootstrapQueryPersister).toHaveBeenCalledWith(cliente));
  });

  it("no propaga fallos de carga de Sentry ni del persister", async () => {
    await expect(
      startServices(cliente, {
        loadSentry: () => Promise.reject(new Error("sin chunk")),
        loadPersister: () => Promise.reject(new Error("sin chunk")),
        schedule: (cb) => cb(),
      }),
    ).resolves.toBeUndefined();
  });
});

describe("scheduleIdle", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
  });

  it("usa requestIdleCallback con timeout de 1500 ms cuando existe", () => {
    const ric = vi.fn();
    (window as { requestIdleCallback?: unknown }).requestIdleCallback = ric;
    const cb = vi.fn();
    scheduleIdle(cb);
    expect(ric).toHaveBeenCalledTimes(1);
    expect(ric.mock.calls[0][1]).toEqual({ timeout: 1500 });
  });

  it("cae a setTimeout de 200 ms cuando no hay requestIdleCallback", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    scheduleIdle(cb);
    vi.advanceTimersByTime(199);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
