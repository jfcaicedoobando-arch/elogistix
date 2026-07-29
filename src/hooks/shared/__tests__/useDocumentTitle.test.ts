import { describe, it, expect } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { buildDocumentTitle, useDocumentTitle } from "../useDocumentTitle";

describe("buildDocumentTitle", () => {
  it("agrega el sufijo de la app cuando hay título", () => {
    expect(buildDocumentTitle("Embarques")).toBe("Embarques · Libre Carga");
  });

  it("usa sólo el sufijo cuando no hay título", () => {
    expect(buildDocumentTitle(undefined)).toBe("Libre Carga");
    expect(buildDocumentTitle("   ")).toBe("Libre Carga");
  });
});

describe("useDocumentTitle", () => {
  afterEach(() => cleanup());

  it("actualiza document.title al montar y lo restaura al desmontar", () => {
    const original = document.title;
    const { unmount } = renderHook(() => useDocumentTitle("Clientes"));
    expect(document.title).toBe("Clientes · Libre Carga");
    unmount();
    expect(document.title).toBe(original);
  });
});
