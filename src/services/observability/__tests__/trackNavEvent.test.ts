import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackNavEvent } from "../trackNavEvent";

const insertMock = vi.fn();
const thenMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (_: string) => ({
      insert: (payload: unknown) => {
        insertMock(payload);
        return { then: thenMock };
      },
    }),
  },
}));

describe("trackNavEvent", () => {
  beforeEach(() => {
    insertMock.mockClear();
    thenMock.mockClear();
    thenMock.mockImplementation((_ok: () => void, _err: () => void) => undefined);
    Object.defineProperty(window, "location", {
      value: { pathname: "/facturacion" },
      writable: true,
    });
  });

  it("inserta con el payload de sidebar", () => {
    trackNavEvent({
      source: "sidebar",
      item_url: "/embarques",
      item_title: "Embarques",
      section_label: "Operación",
      role: "admin",
    });
    expect(insertMock).toHaveBeenCalledWith({
      source: "sidebar",
      item_url: "/embarques",
      item_title: "Embarques",
      section_label: "Operación",
      role: "admin",
    });
    expect(thenMock).toHaveBeenCalled();
  });

  it("no dispara insert dentro del portal", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/portal/embarques" },
      writable: true,
    });
    trackNavEvent({ source: "sidebar", item_url: "/x", item_title: "X" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("no propaga errores si el then falla", () => {
    thenMock.mockImplementation((_ok: () => void, err: () => void) => err());
    expect(() =>
      trackNavEvent({ source: "buscador", item_url: "/x", item_title: "X" }),
    ).not.toThrow();
  });
});
