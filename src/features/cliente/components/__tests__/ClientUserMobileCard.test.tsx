import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientUserMobileCard } from "../ClientUserMobileCard";
import type { ClientUserEnriched } from "@/features/cliente/services/usuarios";

function usuario(overrides: Partial<ClientUserEnriched> = {}): ClientUserEnriched {
  return {
    id: "u1", user_id: "uu1", cliente_id: "c1", organization_id: "o1",
    created_at: "2024-01-01", email: "cliente@acme.mx",
    last_sign_in_at: "2024-02-01", email_confirmed_at: "2024-01-02",
    ...overrides,
  };
}

describe("ClientUserMobileCard", () => {
  it("muestra el email del usuario", () => {
    render(
      <ClientUserMobileCard
        usuario={usuario()}
        canEdit={true}
        onResend={vi.fn()}
        onRevoke={vi.fn()}
        resendPending={false}
        revokePending={false}
      />,
    );
    expect(screen.getByText("cliente@acme.mx")).toBeInTheDocument();
  });
});
