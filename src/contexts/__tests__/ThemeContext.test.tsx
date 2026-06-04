import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../ThemeContext";

vi.mock("@/lib/browserStorage", () => ({
  safeLocalStorage: { getItem: vi.fn(() => null), setItem: vi.fn() },
  STORAGE_KEYS: { theme: "librecarga-theme" },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

describe("ThemeContext", () => {
  it("lanza error cuando useTheme se usa fuera de ThemeProvider", () => {
    expect(() => renderHook(() => useTheme())).toThrow("useTheme debe usarse dentro de un ThemeProvider");
  });

  it("provee theme inicial y toggleTheme cambia el tema", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    const initial = result.current.theme;
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe(initial === "dark" ? "light" : "dark");
  });

  it("setTheme establece el tema directamente", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setTheme("dark"));
    expect(result.current.theme).toBe("dark");
    act(() => result.current.setTheme("light"));
    expect(result.current.theme).toBe("light");
  });
});
