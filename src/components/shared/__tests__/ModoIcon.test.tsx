/**
 * Smoke: `ModoIcon` renderiza los 4 modos de transporte con clases tokenizadas
 * (Lote 3B v13.300.2). Ningún modo puede volver a usar `text-sky-600` ni
 * `bg-purple-100` — todo pasa por tokens `mode-*`, `info` o `warning`.
 */
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ModoIcon } from "@/components/shared/ModoIcon";

const LITERAL = /(?:text|bg)-(?:sky|purple|blue|indigo|violet|cyan|orange)-\d{3}/;

describe("<ModoIcon />", () => {
  const modos = ["Marítimo", "Aéreo", "Terrestre", "Multimodal"] as const;

  it("renderiza los 4 modos sin literales Tailwind", () => {
    for (const m of modos) {
      const { container } = render(<ModoIcon modo={m} circle />);
      expect(container.innerHTML).not.toMatch(LITERAL);
    }
  });

  it("usa tokens semánticos: info (Marítimo), warning (Terrestre), mode-* (Aéreo/Multimodal)", () => {
    const cases: [string, RegExp][] = [
      ["Marítimo", /text-info/],
      ["Aéreo", /text-mode-aereo/],
      ["Terrestre", /text-warning/],
      ["Multimodal", /text-mode-multimodal/],
    ];
    for (const [modo, re] of cases) {
      const { container } = render(<ModoIcon modo={modo} />);
      expect(container.innerHTML).toMatch(re);
    }
  });

  it("fallback a text-muted-foreground para modo desconocido", () => {
    const { container } = render(<ModoIcon modo="Desconocido" />);
    expect(container.innerHTML).toMatch(/text-muted-foreground/);
  });
});
