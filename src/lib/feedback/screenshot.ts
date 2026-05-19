/**
 * Captura del viewport actual para anexar al reporte de feedback.
 * Usa modern-screenshot (lazy import) para no inflar el bundle inicial.
 */

const PICKER_IDS = new Set([
  "feedback-picker-overlay",
  "feedback-picker-label",
  "feedback-picker-hint",
]);

export async function captureViewport(): Promise<File> {
  const { domToBlob } = await import("modern-screenshot");
  const blob = await domToBlob(document.documentElement, {
    scale: Math.min(window.devicePixelRatio || 1, 2),
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    filter: (node) => {
      if (!(node instanceof Element)) return true;
      if (PICKER_IDS.has(node.id)) return false;
      if (typeof node.closest === "function" && node.closest("[data-feedback-modal]")) return false;
      return true;
    },
  });
  if (!blob) throw new Error("No se pudo generar la imagen");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return new File([blob], `captura-${ts}.png`, { type: "image/png" });
}
