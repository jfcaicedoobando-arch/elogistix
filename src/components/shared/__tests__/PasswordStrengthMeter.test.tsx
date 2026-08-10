import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PasswordStrengthMeter } from "../PasswordStrengthMeter";

afterEach(cleanup);

describe("PasswordStrengthMeter", () => {
  it("no muestra etiqueta de fuerza cuando la contraseña está vacía", () => {
    render(<PasswordStrengthMeter password="" />);
    expect(screen.queryByText(/Fuerza:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Mínimo 10 caracteres/)).toBeInTheDocument();
  });

  it("marca como débil una contraseña corta", () => {
    render(<PasswordStrengthMeter password="abc" />);
    expect(screen.getByText("Débil")).toBeInTheDocument();
  });

  it("marca como fuerte una contraseña larga y variada", () => {
    render(<PasswordStrengthMeter password="Abcd1234!xyz" />);
    expect(screen.getByText("Fuerte")).toBeInTheDocument();
  });

  it("permite ocultar la leyenda de requisitos", () => {
    render(<PasswordStrengthMeter password="Abcd1234!xyz" mostrarHint={false} />);
    expect(screen.queryByText(/Mínimo 10 caracteres/)).not.toBeInTheDocument();
  });
});
