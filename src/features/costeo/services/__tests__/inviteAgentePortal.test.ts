import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invokeMock(...a) } },
}));

import { inviteAgentePortal } from "../inviteAgentePortal";

describe("inviteAgentePortal", () => {
  beforeEach(() => invokeMock.mockReset());

  it("invoca user-management con action invite-agente (modo email)", async () => {
    invokeMock.mockResolvedValue({ data: { is_new: true }, error: null });
    const res = await inviteAgentePortal({
      email: "a@b.com", agente_id: "ag", organization_id: "org", mode: "email",
    });
    expect(res.is_new).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith("user-management", expect.objectContaining({
      body: expect.objectContaining({ action: "invite-agente", mode: "email", email: "a@b.com" }),
    }));
  });

  it("incluye la contraseña sólo cuando mode=password", async () => {
    invokeMock.mockResolvedValue({ data: {}, error: null });
    await inviteAgentePortal({
      email: "a@b.com", agente_id: "ag", organization_id: "org", mode: "password", password: "secreta12",
    });
    const [, opts] = invokeMock.mock.calls[0];
    expect(opts.body.password).toBe("secreta12");
  });

  it("propaga el error de Supabase", async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(
      inviteAgentePortal({ email: "x@y.com", agente_id: "a", organization_id: "o", mode: "email" }),
    ).rejects.toThrow("boom");
  });
});
