/**
 * v13.504.0 — Realtime del buzón CxP: canal, filtro y cleanup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const removeChannel = vi.fn();
const subscribe = vi.fn();
const on = vi.fn();
const channel = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (name: string) => channel(name),
    removeChannel: (c: unknown) => removeChannel(c),
  },
}));

import { subscribeEntrantesBuzon } from "../facturasEntrantesRealtime";

describe("subscribeEntrantesBuzon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const fake = { on, subscribe };
    on.mockReturnValue(fake);
    subscribe.mockReturnValue(fake);
    channel.mockReturnValue(fake);
  });

  it("se suscribe a la tabla del buzón y limpia el canal", () => {
    const onChange = vi.fn();
    const cleanup = subscribeEntrantesBuzon("org-1", onChange);

    // EC-09: canal por organización + filtro server-side (sin cross-tenant).
    expect(channel).toHaveBeenCalledWith("cxp-entrantes-buzon-org-1");
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "embarque_facturas_entrantes",
        filter: "organization_id=eq.org-1",
      },
      expect.any(Function),
    );
    expect(subscribe).toHaveBeenCalled();

    // El callback del canal debe propagar el cambio.
    const handler = on.mock.calls[0][2] as (payload: unknown) => void;
    handler({});
    expect(onChange).toHaveBeenCalledTimes(1);

    cleanup();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});
