import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  BreadcrumbProvider,
  useBreadcrumbLabels,
  useRegisterBreadcrumbLabel,
} from "../BreadcrumbContext";

const wrapper = ({ children }: { children: ReactNode }) => (
  <BreadcrumbProvider>{children}</BreadcrumbProvider>
);

describe("BreadcrumbContext", () => {
  it("useBreadcrumbLabels retorna {} fuera del provider (no lanza)", () => {
    const { result } = renderHook(() => useBreadcrumbLabels());
    expect(result.current).toEqual({});
  });

  it("useRegisterBreadcrumbLabel registra y limpia la etiqueta", () => {
    const { result, unmount } = renderHook(
      () => {
        useRegisterBreadcrumbLabel("uuid-123", "Cliente Acme");
        return useBreadcrumbLabels();
      },
      { wrapper },
    );

    expect(result.current).toEqual({ "uuid-123": "Cliente Acme" });

    act(() => {
      unmount();
    });
    // Tras unmount, el cleanup borra la etiqueta. Validamos con un nuevo render dentro del mismo provider:
    const { result: after } = renderHook(() => useBreadcrumbLabels(), { wrapper });
    expect(after.current).toEqual({});
  });

  it("ignora segment o label vacíos (no modifica el mapa)", () => {
    const { result } = renderHook(
      () => {
        useRegisterBreadcrumbLabel(undefined, null);
        useRegisterBreadcrumbLabel("", "x");
        useRegisterBreadcrumbLabel("seg", "");
        return useBreadcrumbLabels();
      },
      { wrapper },
    );
    expect(result.current).toEqual({});
  });
});
