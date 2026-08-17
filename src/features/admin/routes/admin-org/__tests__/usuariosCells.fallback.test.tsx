/**
 * VB-15 — Fallback visual cuando el directorio de auth no resuelve el correo:
 * la celda "Usuario" muestra `full_name` (user_metadata) si existe, y la celda
 * de estado usa "Sin datos" en lugar de un guion cuando el estado es
 * desconocido.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsuarioCell, EstadoInvitacionCell } from "../usuariosCells";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario/constants";
import type { UserRow } from "@/features/admin/services/usuario";

const baseUser: UserRow = {
  user_id: "u1",
  email: UNRESOLVED_EMAIL,
  full_name: null,
  role: "admin",
  created_at: "2026-01-01",
  estado: "desconocido",
  organization_id: "org-1",
  organizacion_nombre: "Org",
};

describe("VB-15 · UsuarioCell fallback", () => {
  it("muestra full_name cuando el correo no se resolvió", () => {
    render(<UsuarioCell user={{ ...baseUser, full_name: "Admin Demo" }} isSelf={false} />);
    expect(screen.getByText("Admin Demo")).toBeInTheDocument();
    expect(screen.getByText("Correo no disponible")).toBeInTheDocument();
  });

  it("muestra el placeholder si tampoco hay full_name", () => {
    render(<UsuarioCell user={baseUser} isSelf={false} />);
    expect(screen.getByText(UNRESOLVED_EMAIL)).toBeInTheDocument();
    expect(screen.queryByText("Correo no disponible")).not.toBeInTheDocument();
  });

  it("ignora full_name cuando el correo sí se resolvió", () => {
    render(
      <UsuarioCell
        user={{ ...baseUser, email: "a@b.com", full_name: "Admin Demo", estado: "activo" }}
        isSelf={false}
      />,
    );
    expect(screen.getByText("a@b.com")).toBeInTheDocument();
    expect(screen.queryByText("Admin Demo")).not.toBeInTheDocument();
  });
});

describe("VB-15 · EstadoInvitacionCell", () => {
  it("estado desconocido muestra 'Sin datos'", () => {
    render(<EstadoInvitacionCell estado="desconocido" />);
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });
});
