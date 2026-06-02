// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveOrgScope, filterUsersByOrg } from "./index.ts";

// ── resolveOrgScope: auth / org guard ────────────────────────

Deno.test("resolveOrgScope: global admin → returns adminOrgId as-is", async () => {
  // No DB call needed when isGlobalAdmin=true
  const result = await resolveOrgScope({} as never, "uid-1", true, "org-99");
  assertEquals(result, "org-99");
});

Deno.test("resolveOrgScope: global admin with null orgId → null (global scope)", async () => {
  const result = await resolveOrgScope({} as never, "uid-1", true, null);
  assertEquals(result, null);
});

Deno.test("resolveOrgScope: adminOrgId present → returned directly (no DB call)", async () => {
  const result = await resolveOrgScope({} as never, "uid-1", false, "org-42");
  assertEquals(result, "org-42");
});

Deno.test("resolveOrgScope: non-admin with membership → returns org from DB", async () => {
  const mockAdmin = {
    from: (_: string) => ({
      select: (_: string) => ({
        eq: (_col: string, _val: string) => ({
          limit: (_n: number) => ({
            maybeSingle: () => Promise.resolve({ data: { organization_id: "org-found" } }),
          }),
        }),
      }),
    }),
  };
  const result = await resolveOrgScope(mockAdmin as never, "uid-1", false, null);
  assertEquals(result, "org-found");
});

Deno.test("resolveOrgScope: non-admin with no membership → throws 403 error", async () => {
  const mockAdmin = {
    from: (_: string) => ({
      select: (_: string) => ({
        eq: (_col: string, _val: string) => ({
          limit: (_n: number) => ({
            maybeSingle: () => Promise.resolve({ data: null }),
          }),
        }),
      }),
    }),
  };
  let threw = false;
  try {
    await resolveOrgScope(mockAdmin as never, "uid-1", false, null);
  } catch (e) {
    threw = true;
    assertEquals((e as Error).message, "403:Sin organización");
  }
  assertEquals(threw, true);
});

// ── filterUsersByOrg: response shape ─────────────────────────

Deno.test("filterUsersByOrg: global admin → all users returned", async () => {
  const users = [{ id: "u1" }, { id: "u2" }, { id: "u3" }];
  const result = await filterUsersByOrg({} as never, users, true, "org-1");
  assertEquals(result.length, 3);
});

Deno.test("filterUsersByOrg: null orgId → all users returned", async () => {
  const users = [{ id: "u1" }, { id: "u2" }];
  const result = await filterUsersByOrg({} as never, users, false, null);
  assertEquals(result.length, 2);
});

Deno.test("filterUsersByOrg: org scope filters to members only", async () => {
  const mockAdmin = {
    from: (_: string) => ({
      select: (_: string) => ({
        eq: (_col: string, _val: string) =>
          Promise.resolve({ data: [{ user_id: "u1" }, { user_id: "u3" }] }),
      }),
    }),
  };
  const users = [{ id: "u1" }, { id: "u2" }, { id: "u3" }];
  const result = await filterUsersByOrg(mockAdmin as never, users, false, "org-1");
  assertEquals(result.length, 2);
  assertEquals(result.map((u) => u.id).sort(), ["u1", "u3"]);
});

Deno.test("filterUsersByOrg: no members in org → empty list", async () => {
  const mockAdmin = {
    from: (_: string) => ({
      select: (_: string) => ({
        eq: (_col: string, _val: string) => Promise.resolve({ data: [] }),
      }),
    }),
  };
  const users = [{ id: "u1" }, { id: "u2" }];
  const result = await filterUsersByOrg(mockAdmin as never, users, false, "org-x");
  assertEquals(result.length, 0);
});
