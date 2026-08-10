import { describe, it, expect, vi, beforeEach } from "vitest";

const { addBreadcrumb } = vi.hoisted(() => ({ addBreadcrumb: vi.fn() }));
vi.mock("@sentry/react", () => ({ addBreadcrumb }));

import { addFiscalBreadcrumb } from "../fiscalBreadcrumbs";

describe("addFiscalBreadcrumb", () => {
  beforeEach(() => addBreadcrumb.mockReset());

  it("adds breadcrumb with category=fiscal, level=info and op as message", async () => {
    addFiscalBreadcrumb("facturapi-request", { facturaId: "f1" });
    await vi.waitFor(() => expect(addBreadcrumb).toHaveBeenCalledTimes(1));
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: "fiscal",
      message: "facturapi-request",
      level: "info",
      data: { facturaId: "f1" },
    });
  });

  it("defaults data to empty object when omitted", async () => {
    addFiscalBreadcrumb("descargar-cfdi");
    await vi.waitFor(() =>
      expect(addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ data: {} })),
    );
  });

  it("swallows sentry errors silently", async () => {
    addBreadcrumb.mockImplementationOnce(() => { throw new Error("sentry down"); });
    expect(() => addFiscalBreadcrumb("abrir-emitir-factura")).not.toThrow();
    await vi.waitFor(() => expect(addBreadcrumb).toHaveBeenCalled());
  });
});
