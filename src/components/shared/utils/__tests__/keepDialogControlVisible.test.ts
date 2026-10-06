import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keepDialogControlVisible } from "../keepDialogControlVisible";

let frames: FrameRequestCallback[];
beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => frames.push(callback)));
});
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function setup(top = 330.09375, height = 120) {
  const container = document.createElement("div");
  const control = document.createElement("textarea");
  container.append(control);
  document.body.append(container);
  Object.defineProperties(container, {
    clientTop: { value: 1 }, clientHeight: { value: 355 }, scrollHeight: { value: 1281 },
  });
  container.style.scrollPaddingTop = "12px";
  container.style.scrollPaddingBottom = "12px";
  container.getBoundingClientRect = () => new DOMRect(9.5, 31.5, 672, 357);
  control.getBoundingClientRect = () => new DOMRect(46.5, top, 598, height);
  container.scrollTop = 596;
  control.focus();
  return { container, control };
}

function flushFocusFrame() {
  for (const frame of frames.splice(0)) frame(0);
}

describe("keepDialogControlVisible", () => {
  it("revela el textarea completo tras el scroll nativo, con el margen CSS y sin mover la página", () => {
    const { container, control } = setup();
    keepDialogControlVisible(container, control);
    expect(container.scrollTop).toBe(596);
    flushFocusFrame();
    expect(container.scrollTop).toBe(671); // ceil(450.09375 - 375.5) = 75
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.activeElement).toBe(control);
  });

  it("redondea hacia fuera cuando el borde superior queda parcialmente recortado", () => {
    const { container, control } = setup(44.09375, 66);
    keepDialogControlVisible(container, control);
    flushFocusFrame();
    expect(container.scrollTop).toBe(595); // floor(44.09375 - 44.5) = -1
  });

  it.each([[100, 120], [10, 500]])("no mueve un control visible o demasiado alto: %s, %s", (top, height) => {
    const { container, control } = setup(top, height);
    keepDialogControlVisible(container, control);
    flushFocusFrame();
    expect(container.scrollTop).toBe(596);
  });

  it("ignora objetivos fuera del diálogo, incluidos portales", () => {
    const { container, control } = setup();
    document.body.append(control);
    keepDialogControlVisible(container, control);
    expect(frames).toHaveLength(0);
    expect(container.scrollTop).toBe(596);
  });

  it.each(["focus", "unmount", "move"])("descarta el callback si cambia su contexto: %s", change => {
    const { container, control } = setup();
    keepDialogControlVisible(container, control);
    if (change === "focus") control.blur();
    if (change === "unmount") container.remove();
    if (change === "move") document.body.append(control);
    flushFocusFrame();
    expect(container.scrollTop).toBe(596);
  });

  it("limita el desplazamiento al rango de scroll del diálogo", () => {
    const { container, control } = setup(330.09375, 120);
    container.scrollTop = 920;
    keepDialogControlVisible(container, control);
    flushFocusFrame();
    expect(container.scrollTop).toBe(926);
  });
});
