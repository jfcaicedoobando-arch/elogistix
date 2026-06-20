import { describe, it, expect } from "vitest";
import type { User } from "@supabase/supabase-js";
import { buildAuthSnapshot, buildSentryUserContext } from "@/lib/auth/authSnapshotBuilder";

const fakeUser = { id: "u1", email: "u@x.com" } as User;
const profile = {
  organizationId: "o1",
  organization: { id: "o1", nombre: "Org X", plan: "pro" } as never,
  role: "operador" as const,
};

describe("buildAuthSnapshot", () => {
  it("compone snapshot completo cuando hay user+profile", () => {
    expect(buildAuthSnapshot(fakeUser, profile, "admin")).toEqual({
      userId: "u1", email: "u@x.com",
      organizationId: "o1", organizationName: "Org X",
      role: "operador", effectiveRole: "admin",
    });
  });

  it("devuelve null en ausencias (user/org/role)", () => {
    expect(buildAuthSnapshot(null, { organizationId: null, organization: null, role: null }, null)).toEqual({
      userId: null, email: null, organizationId: null, organizationName: null, role: null, effectiveRole: null,
    });
  });
});

describe("buildSentryUserContext", () => {
  it("expone subset relevante (sin organizationName ni role base)", () => {
    expect(buildSentryUserContext(fakeUser, profile, "admin")).toEqual({
      userId: "u1", email: "u@x.com", organizationId: "o1", effectiveRole: "admin",
    });
  });

  it("nulls cuando faltan datos", () => {
    expect(buildSentryUserContext(null, { organizationId: null, organization: null, role: null }, null)).toEqual({
      userId: null, email: null, organizationId: null, effectiveRole: null,
    });
  });
});
