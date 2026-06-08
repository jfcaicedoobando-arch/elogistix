/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { descargarBlob } from "@/lib/downloadBlob";

describe("descargarBlob", () => {
  let createSpy: ReturnType<typeof vi.spyOn>;
  let revokeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom no implementa createObjectURL/revokeObjectURL por defecto.
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = vi.fn(
      () => "blob:mock-url",
    );
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = vi.fn();
    createSpy = vi.spyOn(URL, "createObjectURL");
    revokeSpy = vi.spyOn(URL, "revokeObjectURL");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("inyecta un <a> con href+download, hace click y luego lo remueve", () => {
    const clickSpy = vi.fn();
    const appendSpy = vi.spyOn(document.body, "appendChild");
    // Interceptar click en HTMLAnchorElement creado dinámicamente.
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") {
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    });

    const blob = new Blob(["hola"], { type: "text/plain" });
    descargarBlob(blob, "test.txt");

    expect(createSpy).toHaveBeenCalledWith(blob);
    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = appendSpy.mock.calls[0]![0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe("A");
    expect(anchor.download).toBe("test.txt");
    expect(anchor.href).toContain("blob:mock-url");
    // El nodo se removió de inmediato (a.remove()).
    expect(document.body.contains(anchor)).toBe(false);
  });

  it("difiere la revocación de la Object URL al menos 4s (patrón defensivo)", () => {
    const blob = new Blob(["x"], { type: "text/plain" });
    descargarBlob(blob, "x.txt");

    // No debe revocar inmediatamente.
    expect(revokeSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3999);
    expect(revokeSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock-url");
  });

  it("revoca la URL aún si .click() lanza (finally garantiza la limpieza)", () => {
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = document.createElement.wasCalled
        ? document.createElement(tag)
        : ({} as HTMLAnchorElement);
      void el;
      const a = {
        href: "",
        download: "",
        click: () => {
          throw new Error("boom");
        },
        remove: () => {},
      } as unknown as HTMLAnchorElement;
      return a;
    });
    vi.spyOn(document.body, "appendChild").mockImplementation((n) => n as Node);

    const blob = new Blob(["x"], { type: "text/plain" });
    expect(() => descargarBlob(blob, "fail.txt")).toThrow("boom");

    vi.advanceTimersByTime(4000);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock-url");
  });
});
