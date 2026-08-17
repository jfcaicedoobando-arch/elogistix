import { describe, it, expect, beforeEach } from "vitest";
import {
  computeToastDedupeKey,
  shouldSuppressDuplicateToast,
  resetToastDedupeState,
  TOAST_DEDUPE_WINDOW_MS,
} from "../appFeedback.dedupe";

describe("appFeedback.dedupe", () => {
  beforeEach(() => resetToastDedupeState());

  it("no suprime la primera aparición de un mensaje", () => {
    const key = computeToastDedupeKey("error", "Título", "Desc");
    expect(shouldSuppressDuplicateToast(key, 1000)).toBe(false);
  });

  it("suprime un mensaje idéntico dentro de la ventana corta", () => {
    const key = computeToastDedupeKey("error", "Título", "Desc");
    shouldSuppressDuplicateToast(key, 1000);
    expect(shouldSuppressDuplicateToast(key, 1000 + TOAST_DEDUPE_WINDOW_MS - 1)).toBe(true);
  });

  it("permite repetir el mensaje una vez pasada la ventana", () => {
    const key = computeToastDedupeKey("error", "Título", "Desc");
    shouldSuppressDuplicateToast(key, 1000);
    expect(shouldSuppressDuplicateToast(key, 1000 + TOAST_DEDUPE_WINDOW_MS + 1)).toBe(false);
  });

  it("no confunde mensajes distintos", () => {
    const keyA = computeToastDedupeKey("error", "A", "x");
    const keyB = computeToastDedupeKey("error", "B", "x");
    shouldSuppressDuplicateToast(keyA, 1000);
    expect(shouldSuppressDuplicateToast(keyB, 1000)).toBe(false);
  });
});
