// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { DEMO_ACCESS_AVAILABILITY } from "@/features/marketing/lib/demoAccessAvailability";
import { FOOTER } from "@/features/marketing/routes/landingCopy";
import { LandingCtaFinal } from "../LandingCtaFinal";
import { LandingDemo } from "../LandingDemo";
import { LandingHero } from "../LandingHero";
import { LandingNav } from "../LandingNav";

// DOM/state regression only; this does not assert browser layout or mobile GUI coverage.
describe("landing con demo no disponible", () => {
  it("conserva el video y el contacto por correo antes de un error de carga", () => {
    const { container } = render(<LandingDemo />);
    const video = container.querySelector("video");

    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("controls");
    expect(video?.querySelector("source")).toHaveAttribute("src", "/demo-libre-carga.mp4");
    expect(screen.queryByText("Conoce Libre Carga")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agendar demo guiada" })).toHaveAttribute(
      "href",
      `mailto:${FOOTER.contact}?subject=${encodeURIComponent("Quiero una demo guiada de Libre Carga")}`,
    );
  });

  it("describe honestamente el recorrido pendiente cuando falla el video", () => {
    const { container, rerender } = render(<LandingDemo />);
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    fireEvent.error(video!);
    rerender(<LandingDemo />);

    expect(screen.getByText("Conoce Libre Carga")).toBeInTheDocument();
    expect(screen.queryByText("Demo en producción")).not.toBeInTheDocument();
    expect(screen.getByText(
      "Estamos grabando el recorrido oficial. Mientras tanto, podemos darte una demo guiada en vivo.",
    )).toBeInTheDocument();
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("form, input, textarea, select")).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agendar demo guiada" })).toHaveAttribute(
      "href",
      `mailto:${FOOTER.contact}?subject=${encodeURIComponent("Quiero una demo guiada de Libre Carga")}`,
    );
  });

  it.each([
    ["navegación", LandingNav],
    ["hero", LandingHero],
    ["CTA final", LandingCtaFinal],
  ] as const)("mantiene el acceso deshabilitado en %s", (_name, Section) => {
    const { container } = render(<MemoryRouter><Section /></MemoryRouter>);
    const button = screen.getByRole("button", { name: DEMO_ACCESS_AVAILABILITY.label });

    expect(button.tagName).toBe("BUTTON");
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(DEMO_ACCESS_AVAILABILITY.message);
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: "Enter" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container.querySelector("form, input, textarea, select")).toBeNull();
  });
});
